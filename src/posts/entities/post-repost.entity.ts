import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A plain repost of a post. `postId` references `posts.id`, `userId` references
 * `users.id` (both uuid). The unique constraint makes repost/unrepost idempotent.
 */
@Entity('post_reposts')
@Unique(['postId', 'userId'])
export class PostRepost extends MyEntity {
  @Index()
  @Column('uuid')
  postId: string

  @Index()
  @Column('uuid')
  userId: string
}
