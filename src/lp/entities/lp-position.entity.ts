import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A user's LP shares in the pool. `userId` references `users.id` (uuid).
 * On-chain these are the LP tokens held in the user's wallet.
 */
@Entity('lp_position')
export class LpPosition extends MyEntity {
  @Index({ unique: true })
  @Column('uuid')
  userId: string

  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  shares: string
}
