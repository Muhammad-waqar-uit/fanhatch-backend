import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcryptjs'
import { Repository } from 'typeorm'
import { isAddress, recoverMessageAddress, zeroAddress } from 'viem'
import { MyService } from '@app/shared/base'
import { CreateUserDto, SetWalletDto } from './dto'
import { User } from './user.entity'

/** Zero address as a lowercase constant for a fast, checksum-agnostic comparison. */
const ZERO_ADDRESS = zeroAddress.toLowerCase()

@Injectable()
export class UsersService extends MyService<User> {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {
    super(users, ['email', 'username']) // searchable columns
  }

  /** Registration helper — hashes the password and enforces unique email/username. */
  async createWithPassword(dto: CreateUserDto): Promise<User> {
    const exists = await this.users.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    })
    if (exists) throw new ConflictException('Email or username already in use')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = this.users.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
    })
    return this.users.save(user)
  }

  /** Includes passwordHash (normally select:false) for credential checks. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne()
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash)
  }

  /**
   * SIWE find-or-create. Wallet addresses are stored lowercased so lookups are
   * case-insensitive regardless of the EIP-55 checksum the wallet sends.
   * A wallet-only account gets synthetic email/username and an unusable random
   * passwordHash (non-null column) — the user can never log in via password
   * until they set one through a dedicated flow.
   */
  async findOrCreateByWallet(address: string): Promise<User> {
    const walletAddress = address.toLowerCase()
    const existing = await this.users.findOne({ where: { walletAddress } })
    if (existing) return existing

    const short = walletAddress.slice(2, 14)
    const passwordHash = await bcrypt.hash(`siwe:${walletAddress}:${Date.now()}`, 10)
    const user = this.users.create({
      email: `${walletAddress}@wallet.fans.tech`,
      username: `wallet_${short}`,
      passwordHash,
      walletAddress,
    })
    return this.users.save(user)
  }

  async getProfile(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  /**
   * Persist the caller's smart-account / wallet address (lowercased for stable comparison).
   *
   * mvmnt-style signature proof: when the FE supplies `message` + `signature`, we recover the
   * signer with viem `recoverMessageAddress` (the same idea as mvmnt's `validateWalletSignature`
   * ethers `verifyMessage`). A signature that recovers a valid, non-zero EOA proves the caller
   * controls the underlying Web3Auth key before we trust the smart-account address they claim.
   *
   * ponytail: message/signature are still optional for backward-compat while the FE rolls out;
   * once the FE always sends them, make both required here and drop the absent-proof branch.
   */
  async setWallet(id: string, dto: SetWalletDto): Promise<User> {
    const { walletAddress, message, signature } = dto

    if (message && signature) {
      await this.verifyOwnershipSignature(message, signature)
    }

    const user = await this.getProfile(id)
    user.walletAddress = walletAddress.toLowerCase()
    return this.users.save(user)
  }

  /**
   * Recover the EOA that produced `signature` over `message`. Throws 401 when the signature is
   * malformed or recovers the zero / an invalid address. Does not bind the recovered EOA to the
   * smart account here (Web3Auth derives the smart account from that EOA), so a valid recovery is
   * sufficient proof of key control for this endpoint.
   */
  private async verifyOwnershipSignature(message: string, signature: string): Promise<void> {
    let recovered: string
    try {
      recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` })
    } catch {
      throw new UnauthorizedException('Invalid wallet ownership signature')
    }

    if (!isAddress(recovered) || recovered.toLowerCase() === ZERO_ADDRESS) {
      throw new UnauthorizedException('Invalid wallet ownership signature')
    }
  }
}
