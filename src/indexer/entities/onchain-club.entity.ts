import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A club as read from the chain (ClubFactory.ClubCreated). Deliberately separate
 * from the web2 `clubs` table so the indexer never clobbers demo data.
 * `clubId` / `createdAtBlock` are `numeric` → serialized as strings (bigint-safe).
 */
@Entity('onchain_club')
export class OnchainClub extends MyEntity {
  /** Sequential on-chain club id (uint256, stringified). */
  @Index({ unique: true })
  @Column({ type: 'numeric' })
  clubId: string

  /** Deployed ClubKey proxy address — the upsert conflict target. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 42 })
  clubKey: string

  @Column({ type: 'varchar', length: 42 })
  creator: string

  @Column({ type: 'varchar' })
  ticker: string

  /** CurveType enum: 0 = Linear (Casual), 1 = Exponential (Exclusive). */
  @Column({ type: 'int' })
  curveType: number

  @Column({ type: 'numeric' })
  createdAtBlock: string
}
