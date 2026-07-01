import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * How many keys a user holds in a club. `clubId` references `clubs.id` (uuid).
 * Written on club creation (creator → 1) and updated by the web2 buy simulation.
 */
@Entity('holdings')
@Unique(['userId', 'clubId'])
export class Holding extends MyEntity {
  @Index()
  @Column('uuid')
  userId: string

  @Index()
  @Column('uuid')
  clubId: string

  @Column({ type: 'int', default: 1 })
  keyCount: number
}
