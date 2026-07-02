import { Injectable, Logger } from '@nestjs/common'
import { TaskSchedulerService } from '@app/src/task-scheduler/task-scheduler.service'
import { POST_PUBLISH_QUEUE } from '@app/shared/constant/queues'
import { PostScheduler } from './scheduler.service'

/**
 * BullMQ-backed scheduler (active when `REDIS_URL` is set). Translates a post's
 * schedule lifecycle into durable delayed jobs via {@link TaskSchedulerService}.
 * Precise firing replaces the CronScheduler sweep; the reconciler is the safety
 * net. Same `PostScheduler` interface, so PostsService is unchanged.
 */
@Injectable()
export class QueueScheduler extends PostScheduler {
  private readonly logger = new Logger(QueueScheduler.name)

  constructor(private readonly taskScheduler: TaskSchedulerService) {
    super()
  }

  /** Deterministic job id for a post + fire time. */
  private jobId(postId: string, at: Date): string {
    return `post:${postId}:${at.getTime()}`
  }

  onScheduled(postId: string, at: Date): void {
    void this.taskScheduler
      .schedule({
        queue: POST_PUBLISH_QUEUE,
        jobName: 'publish',
        jobId: this.jobId(postId, at),
        payload: { postId },
        scheduledAt: at,
      })
      .catch((err) => this.logger.error(`onScheduled(${postId}) failed`, err as Error))
  }

  onRescheduled(postId: string, at: Date): void {
    // The jobId embeds the fire time, so a new time = a new job. Cancel any
    // pending jobs for this post, then schedule the new one.
    void this.rearm(postId, at).catch((err) =>
      this.logger.error(`onRescheduled(${postId}) failed`, err as Error),
    )
  }

  onCancelled(postId: string): void {
    void this.cancelAll(postId).catch((err) =>
      this.logger.error(`onCancelled(${postId}) failed`, err as Error),
    )
  }

  private async rearm(postId: string, at: Date): Promise<void> {
    await this.cancelAll(postId)
    await this.taskScheduler.schedule({
      queue: POST_PUBLISH_QUEUE,
      jobName: 'publish',
      jobId: this.jobId(postId, at),
      payload: { postId },
      scheduledAt: at,
    })
  }

  private async cancelAll(postId: string): Promise<void> {
    const jobIds = await this.taskScheduler.pendingJobIdsForPost(postId)
    for (const jobId of jobIds) await this.taskScheduler.cancel(jobId)
  }
}
