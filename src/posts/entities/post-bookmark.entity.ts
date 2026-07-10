import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/**
 * A bookmark on a post. `postId` references `posts.id`, `userId` references
 * `users.id` (both uuid). The unique constraint makes bookmark/unbookmark
 * idempotent.
 */
@Entity('post_bookmarks')
@Unique(['postId', 'userId'])
export class PostBookmark extends MyEntity {
  @Index()
  @Column('uuid')
  postId: string

  @Index()
  @Column('uuid')
  userId: string
}
