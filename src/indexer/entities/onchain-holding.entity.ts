import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * How many keys `holder` owns in the ClubKey at `clubKey`, recomputed from the
 * chain (readContract balanceOf) on every key event. One row per (clubKey, holder).
 * `keyCount` is `numeric` → stringified (bigint-safe).
 */
@Entity('onchain_holding')
@Unique(['clubKey', 'holder'])
export class OnchainHolding extends MyEntity {
  @Index()
  @Column({ type: 'varchar', length: 42 })
  clubKey: string

  @Index()
  @Column({ type: 'varchar', length: 42 })
  holder: string

  @Column({ type: 'numeric', default: 0 })
  keyCount: string
}
