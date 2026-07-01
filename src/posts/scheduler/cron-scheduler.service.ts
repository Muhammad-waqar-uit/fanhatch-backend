import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { isPrimaryWorker } from '@app/shared/helpers/cluster.helper'
import { PostsService } from '../posts.service'
import { PostScheduler } from './scheduler.service'

/**
 * No-Redis scheduler. The on* hooks are intentional no-ops: publishing is
 * driven entirely by the cron `sweep()` reading due rows from Postgres, so
 * nothing needs to be enqueued/cancelled out-of-band.
 *
 * A future `QueueScheduler` (BullMQ) will instead enqueue a delayed job in
 * `onScheduled`, replace it in `onRescheduled`, and remove it in `onCancelled`,
 * demoting this sweep to a reconciler.
 */
@Injectable()
export class CronScheduler extends PostScheduler {
  private readonly logger = new Logger(CronScheduler.name)

  constructor(
    // forwardRef breaks the CronScheduler ↔ PostsService circular dependency.
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
  ) {
    super()
  }

  onScheduled(): void {
    // no-op — the cron sweep publishes due posts.
  }

  onRescheduled(): void {
    // no-op — the cron sweep publishes due posts.
  }

  onCancelled(): void {
    // no-op — a cancelled post is no longer `scheduled`, so the sweep skips it.
  }

  /**
   * Every 30s: on the primary worker only, publish any posts whose scheduled
   * time has arrived. The guard keeps a pm2 cluster from running the sweep N×;
   * `publishDuePosts()` is itself idempotent as a second line of defence.
   */
  @Cron('*/30 * * * * *')
  async sweep(): Promise<void> {
    if (!isPrimaryWorker()) return
    try {
      const count = await this.postsService.publishDuePosts()
      if (count > 0) this.logger.log(`Auto-published ${count} scheduled post(s)`)
    } catch (err) {
      this.logger.error('Scheduled-post sweep failed', err as Error)
    }
  }
}
