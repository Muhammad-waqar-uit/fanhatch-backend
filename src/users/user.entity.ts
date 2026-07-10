import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'
import { Status, UserPlan, UserRole } from '@app/shared/enums'

@Entity('users')
export class User extends MyEntity {
  @Index({ unique: true })
  @Column({ unique: true })
  email: string

  @Index({ unique: true })
  @Column({ unique: true })
  username: string

  /** bcrypt hash — never serialized (see toResponseObject). */
  @Column({ select: false })
  passwordHash: string

  @Column({ nullable: true })
  bio?: string

  @Column({ nullable: true })
  avatarUrl?: string

  /** EVM wallet address linked at signup / via SIWE later. */
  @Index({ unique: true, where: '"walletAddress" IS NOT NULL' })
  @Column({ nullable: true })
  walletAddress?: string

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole

  @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
  status: Status

  /** Subscription tier (Premium screen). No billing — selection just records it. */
  @Column({ type: 'enum', enum: UserPlan, default: UserPlan.FREE })
  plan: UserPlan

  /** When the plan last changed. */
  @Column({ type: 'timestamptz', nullable: true })
  planSince?: Date

  /** Unique referral code (generated lazily on first /referrals/me). */
  @Index({ unique: true, where: '"referralCode" IS NOT NULL' })
  @Column({ nullable: true })
  referralCode?: string

  /** The user who referred this account (one-time, set via /referrals/redeem). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  referredById?: string

  /** Web2-simulated ETH balance (numeric → serialized as string). Backed on-chain later. */
  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  ethBalance: string

  /** Web2-simulated FANS balance (numeric → serialized as string). Backed on-chain later. */
  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  fansBalance: string

  toResponseObject() {
    const { passwordHash, ...safe } = this as User & { passwordHash?: string }
    return safe
  }
}
