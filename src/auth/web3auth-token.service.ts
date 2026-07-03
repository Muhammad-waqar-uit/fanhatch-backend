import { Injectable, Logger } from '@nestjs/common'
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto'
import * as jwt from 'jsonwebtoken'

/** env PEM may be raw (with real newlines), \n-escaped, or base64-encoded. Normalize all three. */
function normalizePem(v: string): string {
  if (v.includes('BEGIN')) return v.replace(/\\n/g, '\n')
  return Buffer.from(v, 'base64').toString('utf8')
}

/** RFC-7638 JWK thumbprint (RSA members in lexicographic order) → stable `kid`. */
function jwkThumbprint(key: KeyObject): string {
  const { n, e, kty } = key.export({ format: 'jwk' }) as { n: string; e: string; kty: string }
  return createHash('sha256').update(JSON.stringify({ e, kty, n })).digest('base64url')
}

/**
 * Mints the RS256 id-token that Web3Auth's custom JWT verifier validates (SFA background
 * wallet flow). Separate from the app's HS256 access token — this one is public-key verifiable
 * via the JWKS endpoint so Web3Auth can check it. verifierId claim = email.
 */
@Injectable()
export class Web3AuthTokenService {
  private readonly logger = new Logger(Web3AuthTokenService.name)
  private readonly privatePem: string
  private readonly publicKey: KeyObject
  private readonly kid: string
  private readonly issuer = process.env.WEB3AUTH_ISSUER ?? 'fanstech'
  private readonly audience = process.env.WEB3AUTH_AUD ?? process.env.WEB3AUTH_CLIENT_ID ?? ''

  constructor() {
    const priv = process.env.WEB3AUTH_JWT_PRIVATE_KEY
    let privateKey: KeyObject
    if (priv) {
      privateKey = createPrivateKey(normalizePem(priv))
      this.publicKey = process.env.WEB3AUTH_JWT_PUBLIC_KEY
        ? createPublicKey(normalizePem(process.env.WEB3AUTH_JWT_PUBLIC_KEY))
        : createPublicKey(privateKey)
    } else {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
      privateKey = pair.privateKey
      this.publicKey = pair.publicKey
      this.logger.warn(
        'WEB3AUTH_JWT_PRIVATE_KEY unset — generated an EPHEMERAL RS256 keypair. ' +
          'id-tokens will be invalid after restart; set the env for stable Web3Auth verification.',
      )
    }
    this.privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    this.kid = jwkThumbprint(this.publicKey)
  }

  /** RS256 id-token for Web3Auth SFA `connect({ verifier, verifierId: email, idToken })`. */
  mintIdToken(user: { id: string; email?: string; name?: string }): string {
    return jwt.sign({ email: user.email ?? '', name: user.name ?? user.email ?? '' }, this.privatePem, {
      algorithm: 'RS256',
      subject: user.id,
      issuer: this.issuer,
      audience: this.audience || undefined,
      expiresIn: '1h',
      keyid: this.kid,
    })
  }

  /** Public JWKS for the Web3Auth custom-verifier config (`/auth/jwks`). */
  getJwks() {
    const jwk = this.publicKey.export({ format: 'jwk' }) as Record<string, unknown>
    return { keys: [{ ...jwk, kid: this.kid, alg: 'RS256', use: 'sig' }] }
  }
}
