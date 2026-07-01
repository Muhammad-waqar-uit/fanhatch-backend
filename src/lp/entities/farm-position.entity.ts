import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A user's staked LP shares + accrued rewards (web2 simulation of StakingManager).
 * `userId` references `users.id` (uuid). On-chain the stake + rewards live in
 * the `StakingManager` contract.
 */
@Entity('farm_position')
export class FarmPosition extends MyEntity {
  @Index({ unique: true })
  @Column('uuid')
  userId: string

  /** LP shares currently staked. */
  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  staked: string

  /** Accrued (unclaimed) FANS rewards. */
  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  rewards: string
}
