import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A like on a post. `postId` references `posts.id`, `userId` references
 * `users.id` (both uuid). The unique constraint makes like/unlike idempotent.
 */
@Entity('post_likes')
@Unique(['postId', 'userId'])
export class PostLike extends MyEntity {
  @Index()
  @Column('uuid')
  postId: string

  @Index()
  @Column('uuid')
  userId: string
}
