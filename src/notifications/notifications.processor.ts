import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { NOTIFICATIONS_QUEUE } from '@app/shared/constant/queues'
import { NotificationFanoutJob, NotificationsService } from './notifications.service'

/**
 * Consumes NOTIFICATIONS_QUEUE fan-out jobs: for each recipient, create the
 * notification (settings-gated) and push it live. Registered ONLY when Redis is
 * present AND `RUN_WORKERS !== 'false'` (see notifications.module) — mirroring
 * the post-publish processor, so an API-only process enqueues but doesn't consume.
 *
 * Per-user failures are swallowed so one bad recipient can't fail the whole
 * batch; the job itself only throws (→ BullMQ retry) on an unexpected error.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name)

  constructor(private readonly notifications: NotificationsService) {
    super()
  }

  async process(job: Job<NotificationFanoutJob>): Promise<void> {
    const { userIds, payload } = job.data
    let delivered = 0
    for (const userId of userIds) {
      try {
        const result = await this.notifications.create({ ...payload, userId })
        if (!('skipped' in result)) delivered += 1
      } catch (err) {
        this.logger.warn(
          `Fan-out to user ${userId} failed (job ${job.id}): ${(err as Error).message}`,
        )
      }
    }
    this.logger.log(
      `Fan-out job ${job.id}: delivered ${delivered}/${userIds.length} (${payload.type})`,
    )
  }
}
