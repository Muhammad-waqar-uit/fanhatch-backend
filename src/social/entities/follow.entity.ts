import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * Social graph edge: `followerId` follows `followeeId`. Unique per pair;
 * self-follow is blocked in the service (409).
 */
@Entity('follows')
@Unique(['followerId', 'followeeId'])
export class Follow extends MyEntity {
  @Index()
  @Column('uuid')
  followerId: string

  @Index()
  @Column('uuid')
  followeeId: string
}
