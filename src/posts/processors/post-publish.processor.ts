import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { TaskSchedulerService } from '@app/src/task-scheduler/task-scheduler.service'
import { POST_PUBLISH_QUEUE } from '@app/shared/constant/queues'
import { PostsService } from '../posts.service'

/**
 * Consumes `post-publish` jobs. Registered ONLY when `RUN_WORKERS !== 'false'`
 * (so an API-only process enqueues but doesn't process). `process` is idempotent
 * end-to-end: {@link PostsService.publishScheduledPost} only publishes a still-
 * scheduled row, and the task row is marked COMPLETED. On throw we mark FAILED
 * and rethrow so BullMQ applies its retry/backoff policy.
 */
@Processor(POST_PUBLISH_QUEUE)
export class PostPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PostPublishProcessor.name)

  constructor(
    private readonly postsService: PostsService,
    private readonly taskScheduler: TaskSchedulerService,
  ) {
    super()
  }

  async process(job: Job<{ postId: string }>): Promise<void> {
    const { postId } = job.data
    const jobId = job.id as string
    try {
      const published = await this.postsService.publishScheduledPost(postId)
      await this.taskScheduler.markCompleted(jobId)
      this.logger.log(
        `Published scheduled post ${postId} (job ${jobId})${published ? '' : ' [already published/no-op]'}`,
      )
    } catch (err) {
      await this.taskScheduler.markFailed(jobId, (err as Error).message)
      this.logger.error(`Failed to publish post ${postId} (job ${jobId})`, err as Error)
      throw err
    }
  }
}
