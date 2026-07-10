import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** Publication state of a post (matches the composer's schedule/draft flow). */
export enum PostStatus {
  PUBLISHED = 'published',
  SCHEDULED = 'scheduled',
  DRAFT = 'draft',
}

/**
 * A social feed post. `authorId` references `users.id` (uuid). Only
 * `status = 'published'` rows surface in the public feed; scheduled/draft are
 * held back. `crossPostTargets` records the platforms the post was mirrored to
 * (e.g. `['x']`) — web2 metadata only for now.
 */
@Entity('posts')
export class Post extends MyEntity {
  @Index()
  @Column('uuid')
  authorId: string

  /**
   * Self-referential parent. `null` → top-level post; non-null → a reply to the
   * post with this id. Arbitrary nesting is allowed. Indexed for child lookups.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId?: string | null

  @Column({ type: 'text' })
  body: string

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.PUBLISHED })
  status: PostStatus

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null

  /** When the post actually went live (set on publish / auto-publish). */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null

  @Column({ type: 'jsonb', nullable: true })
  crossPostTargets?: string[] | null
}
