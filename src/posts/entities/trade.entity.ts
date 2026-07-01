import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** Direction of a key trade. */
export enum TradeSide {
  BUY = 'buy',
  SELL = 'sell',
}

/**
 * A key-trading activity row, surfaced under the feed's "Transactions" filter.
 * `actorId` references `users.id`, `clubId` references `clubs.id` (both uuid).
 * `pricePerKey` is the web2 key price at trade time (numeric → string).
 */
@Entity('trades')
export class Trade extends MyEntity {
  @Index()
  @Column('uuid')
  actorId: string

  @Index()
  @Column('uuid')
  clubId: string

  @Column()
  ticker: string

  @Column({ type: 'enum', enum: TradeSide })
  side: TradeSide

  /** Number of keys traded. */
  @Column({ type: 'int' })
  amount: number

  @Column({ type: 'numeric', precision: 20, scale: 8 })
  pricePerKey: string
}
