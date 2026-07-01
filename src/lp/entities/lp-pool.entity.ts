import { Column, Entity } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * The AMM pool — a single singleton row (web2 simulation of FansSwap's ETH/FANS pair).
 * All reserves/shares are `numeric` so pg serializes them as decimal strings.
 * On-chain the reserves live in the `FansSwap` pair contract; this row mirrors them.
 */
@Entity('lp_pool')
export class LpPool extends MyEntity {
  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  reserveEth: string

  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  reserveFans: string

  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  totalShares: string
}
