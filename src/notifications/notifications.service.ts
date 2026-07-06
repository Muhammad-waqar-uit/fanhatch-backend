import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import type { Queue } from 'bullmq'
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm'
import { MyService } from '@app/shared/base'
import { User } from '@app/src/users/user.entity'
import { NOTIFICATIONS_QUEUE } from '@app/shared/constant/queues'
import { Notification } from './entities/notification.entity'
import { NotificationSetting } from './entities/notification-setting.entity'
import {
  NotificationStatus,
  NotificationRelatedTo,
  NotificationReceiverType,
  NotificationSettingType,
} from './enums'
import { NOTIFICATION_TYPE_TO_SETTING } from './constants/notification-setting-map'
import {
  ChangeSettingDto,
  CreateNotificationPayload,
  NotificationDto,
  NotificationListRO,
  NotifyManyPayload,
  QueryNotificationsDto,
} from './dto'
import { NotificationEmitter } from './notifications.emitter'

/** Result of a settings-gated dispatch that was muted by the recipient. */
type SkipResult = { skipped: true }

/** Grouped unread counts keyed by lowercased relatedTo, plus a `total`. */
export type UnreadCountMap = Record<string, number> & { total: number }

/** Payload carried on a NOTIFICATIONS_QUEUE fan-out job. */
export interface NotificationFanoutJob {
  userIds: string[]
  payload: NotifyManyPayload
}

@Injectable()
export class NotificationsService extends MyService<Notification> {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationSetting)
    private readonly settingRepo: Repository<NotificationSetting>,
    private readonly emitter: NotificationEmitter,
    // Present only when Redis is configured (queue registered in the module).
    @Optional()
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue?: Queue<NotificationFanoutJob>,
  ) {
    super(notificationRepo, ['title'])
  }

  // ---- create (settings-gated + real-time emit) --------------------------

  /**
   * Dispatch one notification to `payload.userId`.
   *
   * Gating: if the type maps to a {@link NotificationSettingType} and the
   * recipient has that bucket toggled off, the insert is skipped entirely
   * (`{ skipped: true }`). The actor is never notified about their own action.
   * On a real insert we push `notification:new` + a refreshed `notification:count`.
   *
   * The second overload keeps this method structurally compatible with the
   * inherited `MyService.create(dto: DeepPartial<Notification>)`.
   */
  create(payload: CreateNotificationPayload): Promise<Notification | SkipResult>
  create(dto: DeepPartial<Notification>): Promise<Notification>
  async create(
    payload: CreateNotificationPayload | DeepPartial<Notification>,
  ): Promise<Notification | SkipResult> {
    const p = payload as CreateNotificationPayload

    // Never notify the actor about their own action.
    const actorId = (p.data as Record<string, unknown> | undefined)?.actorId
    if (actorId && actorId === p.userId) return { skipped: true }

    // Settings gate: mapped type + a stored row with status=false → skip.
    const settingType = NOTIFICATION_TYPE_TO_SETTING[p.type]
    if (settingType) {
      const setting = await this.settingRepo.findOne({
        where: { user: { id: p.userId }, type: settingType },
      })
      if (setting && setting.status === false) return { skipped: true }
    }

    const saved = await this.notificationRepo.save(
      this.notificationRepo.create({
        title: p.title,
        body: p.body,
        type: p.type,
        relatedTo: p.relatedTo,
        data: p.data ?? {},
        user: { id: p.userId } as User,
      }),
    )

    this.emitter.emitToUser(p.userId, 'notification:new', this.toDto(saved))
    await this.emitCount(p.userId)
    return saved
  }

  /**
   * Fan a single payload out to many recipients (e.g. POST_PUBLISHED → all key
   * holders). The actor is excluded and ids de-duplicated. With Redis, one
   * durable job is enqueued and the worker creates + emits per user; otherwise
   * we create in-process.
   */
  async notifyMany(userIds: string[], payload: NotifyManyPayload): Promise<void> {
    const actorId = (payload.data as Record<string, unknown> | undefined)?.actorId
    const recipients = [...new Set(userIds)].filter((id) => id && id !== actorId)
    if (!recipients.length) return

    if (this.queue) {
      await this.queue.add(
        'fanout',
        { userIds: recipients, payload },
        { removeOnComplete: true, removeOnFail: 100 },
      )
      return
    }

    for (const userId of recipients) {
      await this.create({ ...payload, userId })
    }
  }

  // ---- reads --------------------------------------------------------------

  /** Paginated, filtered list for the owner (contract meta shape). */
  async list(userId: string, query: QueryNotificationsDto): Promise<NotificationListRO> {
    const { page = 1, limit = 15, relatedTo, read } = query

    const qb = this.notificationRepo
      .createQueryBuilder('notification')
      .where('"notification"."userId" = :userId', { userId })
      .andWhere('notification.status != :deleted', { deleted: NotificationStatus.DELETED })
      .andWhere('notification.receiverType = :receiverType', {
        receiverType: NotificationReceiverType.USER,
      })

    if (relatedTo?.length) {
      qb.andWhere('notification.relatedTo IN (:...relatedTo)', { relatedTo })
    }

    if (read === true) {
      qb.andWhere('notification.status = :status', { status: NotificationStatus.READ })
    } else if (read === false) {
      qb.andWhere('notification.status = :status', { status: NotificationStatus.UNREAD })
    }

    const [items, total] = await qb
      .orderBy('notification.created', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return {
      data: items.map((n) => this.toDto(n)),
      meta: {
        total_page: Math.ceil(total / limit) || 0,
        current_page: page,
        limit,
        total_record: total,
      },
    }
  }

  /** Single notification for the owner (404 if missing or soft-deleted). */
  async getOne(id: string, userId: string): Promise<NotificationDto> {
    const notif = await this.notificationRepo.findOne({
      where: { id, user: { id: userId } } as FindOptionsWhere<Notification>,
    })
    if (!notif || notif.status === NotificationStatus.DELETED) {
      throw new NotFoundException('Notification not found')
    }
    return this.toDto(notif)
  }

  /** Grouped unread counts (all relatedTo keys 0-seeded) + total. */
  async unreadCount(userId: string): Promise<UnreadCountMap> {
    const counts = Object.values(NotificationRelatedTo).reduce<Record<string, number>>(
      (acc, relatedTo) => ({ ...acc, [relatedTo.toLowerCase()]: 0 }),
      {},
    )

    const rows = await this.notificationRepo
      .createQueryBuilder('notification')
      .select('notification.relatedTo', 'relatedTo')
      .addSelect('COUNT(notification.id)::int', 'count')
      .where('"notification"."userId" = :userId', { userId })
      .andWhere('notification.status = :status', { status: NotificationStatus.UNREAD })
      .andWhere('notification.receiverType = :receiverType', {
        receiverType: NotificationReceiverType.USER,
      })
      .groupBy('notification.relatedTo')
      .getRawMany<{ relatedTo: NotificationRelatedTo; count: number }>()

    let total = 0
    for (const row of rows) {
      const count = Number(row.count)
      counts[row.relatedTo.toLowerCase()] = count
      total += count
    }

    return { ...counts, total }
  }

  // ---- mutations ----------------------------------------------------------

  /** Mark one notification read (owner-scoped); emits refreshed count. */
  async markRead(id: string, userId: string): Promise<NotificationDto> {
    const notif = await this.notificationRepo.findOne({
      where: { id, user: { id: userId } } as FindOptionsWhere<Notification>,
    })
    if (!notif || notif.status === NotificationStatus.DELETED) {
      throw new NotFoundException('Notification not found')
    }

    if (notif.status === NotificationStatus.UNREAD) {
      notif.status = NotificationStatus.READ
      notif.readAt = new Date()
      await this.notificationRepo.save(notif)
      await this.emitCount(userId)
    }

    return this.toDto(notif)
  }

  /** Mark every unread notification read; returns the affected count. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo.update(
      { user: { id: userId }, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ, readAt: new Date() },
    )
    await this.emitCount(userId)
    return { updated: result.affected ?? 0 }
  }

  /**
   * Soft-delete a notification (status → DELETED), owner-scoped. `userId` is
   * optional so this stays compatible with the inherited `MyService.remove(id)`.
   */
  async remove(id: string, userId?: string): Promise<void> {
    const where = (userId ? { id, user: { id: userId } } : { id }) as FindOptionsWhere<Notification>
    const notif = await this.notificationRepo.findOne({ where })
    if (!notif) throw new NotFoundException('Notification not found')

    const wasUnread = notif.status === NotificationStatus.UNREAD
    notif.status = NotificationStatus.DELETED
    await this.notificationRepo.save(notif)
    if (userId && wasUnread) await this.emitCount(userId)
  }

  // ---- settings -----------------------------------------------------------

  /** All setting types with the user's status (defaulting missing rows to true). */
  async getSettings(userId: string): Promise<{ type: NotificationSettingType; status: boolean }[]> {
    const rows = await this.settingRepo.find({ where: { user: { id: userId } } })
    const stored = new Map(rows.map((r) => [r.type, r.status]))
    return Object.values(NotificationSettingType).map((type) => ({
      type,
      status: stored.get(type) ?? true,
    }))
  }

  /** Upsert one (user, type) preference. */
  async changeSetting(
    userId: string,
    dto: ChangeSettingDto,
  ): Promise<{ type: NotificationSettingType; status: boolean }> {
    let row = await this.settingRepo.findOne({
      where: { user: { id: userId }, type: dto.type },
    })
    if (row) {
      row.status = dto.status
    } else {
      row = this.settingRepo.create({
        user: { id: userId } as User,
        type: dto.type,
        status: dto.status,
      })
    }
    await this.settingRepo.save(row)
    return { type: dto.type, status: dto.status }
  }

  // ---- helpers ------------------------------------------------------------

  private async emitCount(userId: string): Promise<void> {
    const counts = await this.unreadCount(userId)
    this.emitter.emitToUser(userId, 'notification:count', counts)
  }

  private toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      relatedTo: n.relatedTo,
      status: n.status,
      title: n.title,
      body: n.body,
      data: n.data ?? {},
      createdAt: n.created,
      readAt: n.readAt ?? null,
    }
  }
}
