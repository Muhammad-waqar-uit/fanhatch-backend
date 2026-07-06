import { Column, Entity, Index, ManyToOne } from 'typeorm'
import { MyEntity } from '@app/shared/base'
import { User } from '@app/src/users/user.entity'
import {
  NotificationType,
  NotificationStatus,
  NotificationRelatedTo,
  NotificationReceiverType,
} from '../enums'

/**
 * A single in-app notification addressed to one recipient (`user`).
 *
 * `data` is a free-form jsonb blob carrying the per-type render + deep-link
 * payload (see the notifications contract). Reads are served filtered by
 * `user` + `status != DELETED`; the composite `(user, status)` index backs both
 * the paginated list and the grouped unread-count query.
 */
@Entity('notifications')
@Index(['user', 'status'])
export class Notification extends MyEntity {
  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string

  @Column({ type: 'text', nullable: true })
  body?: string

  /** Recipient. FK `userId` is indexed for the per-user list/count queries. */
  @Index()
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user: User

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType

  @Column({ type: 'enum', enum: NotificationRelatedTo, default: NotificationRelatedTo.USER })
  relatedTo: NotificationRelatedTo

  @Column({ type: 'enum', enum: NotificationReceiverType, default: NotificationReceiverType.USER })
  receiverType: NotificationReceiverType

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus

  /** Per-type render + deep-link payload (actorId/actorName/actorAvatarUrl + type-specific fields). */
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: true })
  readAt?: Date
}
