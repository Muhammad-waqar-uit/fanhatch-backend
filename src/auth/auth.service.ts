import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SiweMessage, generateNonce } from 'siwe'
import { IJwtPayload } from '@app/shared/interfaces'
import { User } from '@app/src/users/user.entity'
import { UsersService } from '@app/src/users/users.service'
import { IAuthUser } from '@app/shared/interfaces'
import { LoginDto, RegisterDto, SiweVerifyDto } from './dto'
import { Web3AuthTokenService } from './web3auth-token.service'

/** How long an issued SIWE nonce stays valid before it must be re-requested. */
const NONCE_TTL_MS = 5 * 60 * 1000

@Injectable()
export class AuthService {
  /**
   * Issued SIWE nonces → expiry epoch (ms). Single-use: consumed on verify.
   *
   * PONYTAIL CEILING: in-memory is correct only for a single instance. Behind a
   * load balancer / multiple replicas a nonce issued by one node won't be found
   * on another. Move this to Redis (or a short-TTL DB table) before scaling out.
   */
  private readonly nonces = new Map<string, number>()

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly web3auth: Web3AuthTokenService,
  ) {}

  /** Mint a fresh Web3Auth SFA id-token for an already-authenticated principal. */
  mintWeb3AuthToken(user: IAuthUser): { web3authToken: string } {
    return { web3authToken: this.web3auth.mintIdToken({ id: user.id, email: user.email }) }
  }

  /** Public JWKS for the Web3Auth custom-verifier config. */
  getWeb3AuthJwks() {
    return this.web3auth.getJwks()
  }

  async register(dto: RegisterDto) {
    const user = await this.users.createWithPassword(dto)
    return this.issue(user)
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithSecret(dto.email)
    if (!user || !(await this.users.verifyPassword(user, dto.password))) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return this.issue(user)
  }

  /** Mint a single-use nonce for a SIWE challenge and remember its expiry. */
  createSiweNonce(): string {
    this.pruneNonces()
    const nonce = generateNonce()
    this.nonces.set(nonce, Date.now() + NONCE_TTL_MS)
    return nonce
  }

  /**
   * Verify a signed SIWE message against a previously issued nonce, then
   * find-or-create the user by wallet address and issue the standard JWT payload.
   */
  async verifySiwe(dto: SiweVerifyDto) {
    let siwe: SiweMessage
    try {
      siwe = new SiweMessage(dto.message)
    } catch {
      throw new UnauthorizedException('Malformed SIWE message')
    }

    const expiry = this.nonces.get(siwe.nonce)
    if (!expiry || expiry < Date.now()) {
      this.nonces.delete(siwe.nonce)
      throw new UnauthorizedException('Invalid or expired nonce')
    }

    try {
      const result = await siwe.verify({ signature: dto.signature, nonce: siwe.nonce })
      if (!result.success) throw new Error('verification failed')
    } catch {
      throw new UnauthorizedException('Invalid signature')
    }

    // Single-use: burn the nonce whether or not the user existed.
    this.nonces.delete(siwe.nonce)

    const user = await this.users.findOrCreateByWallet(siwe.address)
    return this.issue(user)
  }

  /** Drop expired nonces so the Map doesn't grow unbounded. */
  private pruneNonces() {
    const now = Date.now()
    for (const [nonce, expiry] of this.nonces) {
      if (expiry < now) this.nonces.delete(nonce)
    }
  }

  private issue(user: User) {
    const payload: IJwtPayload = { sub: user.id, email: user.email, role: user.role }
    return {
      accessToken: this.jwt.sign(payload),
      // RS256 id-token for the Web3Auth SFA background-wallet flow (see web3-sfa-contract.md).
      web3authToken: this.web3auth.mintIdToken({ id: user.id, email: user.email, name: user.username }),
      user: user.toResponseObject(),
    }
  }
}
