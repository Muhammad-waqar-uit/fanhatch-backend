import { Column, Entity, ManyToOne, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'
import { User } from '@app/src/users/user.entity'
import { NotificationSettingType } from '../enums'

/**
 * A user's on/off preference for one {@link NotificationSettingType} bucket.
 *
 * One row per (user, type) — enforced by `@Unique(['user','type'])` so
 * `changeSetting` can upsert safely. Absence of a row means "default true":
 * `getSettings` seeds every setting type at `status=true` and overlays stored
 * rows, and `create` only skips a notification when a matching row is present
 * with `status=false`.
 */
@Entity('notification_settings')
@Unique(['user', 'type'])
export class NotificationSetting extends MyEntity {
  @Column({ type: 'boolean', default: true })
  status: boolean

  @Column({ type: 'enum', enum: NotificationSettingType })
  type: NotificationSettingType

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user: User
}
