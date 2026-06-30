import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'
import { Status, UserRole } from '@app/shared/enums'

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

  toResponseObject() {
    const { passwordHash, ...safe } = this as User & { passwordHash?: string }
    return safe
  }
}
