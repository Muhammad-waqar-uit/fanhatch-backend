import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A web2 governance vote for a club president. Simulates the on-chain
 * GovernanceModule: vote weight = keys held, and a simple majority of the
 * club's key supply elects a president. `clubId` references `clubs.id` (uuid).
 *
 * One vote per (club, voter) — re-voting overwrites the existing row, so the
 * stored `weight` always reflects the voter's current keyCount.
 */
@Entity('votes')
@Unique(['clubId', 'voterId'])
export class Vote extends MyEntity {
  @Index()
  @Column('uuid')
  clubId: string

  @Index()
  @Column('uuid')
  voterId: string

  @Index()
  @Column('uuid')
  candidateId: string

  /** Snapshot of the voter's key count at vote time (their voting weight). */
  @Column({ type: 'int', default: 1 })
  weight: number
}
