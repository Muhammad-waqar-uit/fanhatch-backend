import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** The three figma curve presets (Casual gentle, Standard medium, Exclusive steep). */
export enum ClubCurveType {
  CASUAL = 'casual',
  STANDARD = 'standard',
  EXCLUSIVE = 'exclusive',
}

/** Optional off-chain social links surfaced on the club page. */
export interface ClubSocials {
  x?: string
  email?: string
  website?: string
}

/**
 * A club: metadata + a web2 "bonding-curve-ish" key price simulated in Postgres.
 * On create: `supply=1` (creator's free first key), the creator gets a `holdings`
 * row (key_count=1), and a club chat room + creator room_member(role='president')
 * are provisioned via RoomService. On-chain `ClubFactory.createClub` comes later.
 */
@Entity('clubs')
export class Club extends MyEntity {
  /** Sequential human-facing club number (assigned in the service). */
  @Index({ unique: true })
  @Column({ type: 'int' })
  clubId: number

  /** Public id — `FT` + clubId. */
  @Index({ unique: true })
  @Column()
  ftId: string

  @Column()
  name: string

  @Column()
  ticker: string

  @Column({ nullable: true })
  description?: string

  @Column({ nullable: true })
  avatarUrl?: string

  @Column({ type: 'enum', enum: ClubCurveType })
  curveType: ClubCurveType

  @Index()
  @Column('uuid')
  creatorId: string

  @Column({ type: 'jsonb', nullable: true })
  socials?: ClubSocials

  @Column({ type: 'int', default: 1 })
  supply: number

  /** Current web2 key price (numeric → serialized as string by TypeORM/pg). */
  @Column({ type: 'numeric', precision: 20, scale: 8, default: 0 })
  keyPrice: string

  @Column({ type: 'int', default: 1 })
  memberCount: number

  /**
   * Current elected president (web2 GovernanceModule sim). Null until a
   * candidate's vote weight passes a simple majority of `supply`.
   */
  @Column({ type: 'uuid', nullable: true })
  presidentId?: string
}
