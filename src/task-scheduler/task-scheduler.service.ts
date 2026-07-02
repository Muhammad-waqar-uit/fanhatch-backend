import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { getQueueToken } from '@nestjs/bullmq'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThanOrEqual, Repository } from 'typeorm'
import type { Queue } from 'bullmq'
import { isPrimaryWorker } from '@app/shared/helpers/cluster.helper'
import { ScheduledTask, ScheduledTaskStatus } from './entities/scheduled-task.entity'

/** Input for {@link TaskSchedulerService.schedule}. */
export interface ScheduleTaskInput {
  queue: string
  jobName: string
  /** Deterministic, unique id — dedupes the BullMQ job + task row. */
  jobId: string
  payload: Record<string, unknown>
  scheduledAt: Date
  /** BullMQ retry attempts (default 3). */
  attempts?: number
  /** Exponential backoff base in ms (default 5000). */
  backoffMs?: number
}

/** How far ahead the reconciler re-enqueues missing jobs. */
const RECONCILE_WINDOW_MS = 15 * 60 * 1000

/**
 * Durable scheduler modeled on mvmnt's `TaskSchedulerService`.
 *
 * Every job is backed by a Postgres `scheduled_task` row written PENDING before
 * the delayed BullMQ job is enqueued. The row is the source of truth; BullMQ is
 * the delivery mechanism. If Redis drops a job, {@link reconcile} re-enqueues it
 * from the row. Queues are resolved generically via `ModuleRef` + queue token,
 * so this service has no static dependency on any specific queue.
 */
@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name)

  constructor(
    @InjectRepository(ScheduledTask)
    private readonly tasks: Repository<ScheduledTask>,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Resolve a BullMQ queue by name from anywhere in the DI container. */
  private queue(name: string): Queue {
    return this.moduleRef.get<Queue>(getQueueToken(name), { strict: false })
  }

  /**
   * Persist a PENDING task row (deterministic `jobId` = dedupe key) and enqueue
   * a delayed BullMQ job firing at `scheduledAt`, with retries + exponential
   * backoff.
   */
  async schedule(input: ScheduleTaskInput): Promise<ScheduledTask> {
    const { queue, jobName, jobId, payload, scheduledAt } = input
    const attempts = input.attempts ?? 3
    const backoffMs = input.backoffMs ?? 5000

    const existing = await this.tasks.findOne({ where: { jobId } })
    const row = this.tasks.merge(existing ?? this.tasks.create(), {
      queue,
      jobName,
      jobId,
      payload,
      scheduledAt,
      attempts,
      status: ScheduledTaskStatus.PENDING,
      lastError: null,
      completedAt: null,
    })
    const saved = await this.tasks.save(row)

    await this.enqueue(saved, backoffMs)
    this.logger.log(`Scheduled ${jobId} on "${queue}" for ${scheduledAt.toISOString()}`)
    return saved
  }

  /** Cancel a task: remove the BullMQ job (if any) and mark the row CANCELLED. */
  async cancel(jobId: string): Promise<void> {
    const row = await this.tasks.findOne({ where: { jobId } })
    if (!row) return
    await this.removeJob(row.queue, jobId)
    row.status = ScheduledTaskStatus.CANCELLED
    await this.tasks.save(row)
    this.logger.log(`Cancelled ${jobId}`)
  }

  /** Move a pending task's fire time: replace the delayed BullMQ job in place. */
  async reschedule(jobId: string, newAt: Date): Promise<void> {
    const row = await this.tasks.findOne({ where: { jobId } })
    if (!row) return
    await this.removeJob(row.queue, jobId)
    row.scheduledAt = newAt
    row.status = ScheduledTaskStatus.PENDING
    row.lastError = null
    row.completedAt = null
    const saved = await this.tasks.save(row)
    await this.enqueue(saved)
    this.logger.log(`Rescheduled ${jobId} to ${newAt.toISOString()}`)
  }

  /** Mark a task COMPLETED (called by the processor after success). */
  async markCompleted(jobId: string): Promise<void> {
    await this.tasks.update({ jobId }, { status: ScheduledTaskStatus.COMPLETED, completedAt: new Date() })
  }

  /** Record a failure: bump attempts, store the error, mark FAILED. */
  async markFailed(jobId: string, error: string): Promise<void> {
    const row = await this.tasks.findOne({ where: { jobId } })
    if (!row) return
    row.attempts = (row.attempts ?? 0) + 1
    row.lastError = error?.slice(0, 2000) ?? 'unknown error'
    row.status = ScheduledTaskStatus.FAILED
    await this.tasks.save(row)
  }

  /** Active (PENDING) job ids for a post, used by the QueueScheduler to re-arm. */
  async pendingJobIdsForPost(postId: string): Promise<string[]> {
    const rows = await this.tasks.find({
      where: { status: ScheduledTaskStatus.PENDING },
    })
    return rows.filter((r) => (r.payload as { postId?: string })?.postId === postId).map((r) => r.jobId)
  }

  /**
   * Reconciler: every 5 minutes, on the primary worker only, re-enqueue any
   * PENDING row due within the window whose BullMQ job has gone missing (Redis
   * flush / lost job). Idempotent — the deterministic jobId dedupes.
   */
  @Cron('0 */5 * * * *')
  async reconcile(): Promise<void> {
    if (!isPrimaryWorker()) return
    if (process.env.RUN_WORKERS === 'false') return

    const dueBy = new Date(Date.now() + RECONCILE_WINDOW_MS)
    const rows = await this.tasks.find({
      where: { status: ScheduledTaskStatus.PENDING, scheduledAt: LessThanOrEqual(dueBy) },
    })

    let requeued = 0
    for (const row of rows) {
      try {
        const job = await this.queue(row.queue).getJob(row.jobId)
        if (!job) {
          await this.enqueue(row)
          requeued++
        }
      } catch (err) {
        this.logger.error(`Reconcile failed for ${row.jobId}`, err as Error)
      }
    }
    if (requeued > 0) this.logger.log(`Reconciler re-enqueued ${requeued} missing job(s)`)
  }

  // ---- internals ---------------------------------------------------------

  private async enqueue(row: ScheduledTask, backoffMs = 5000): Promise<void> {
    const delay = Math.max(0, row.scheduledAt.getTime() - Date.now())
    await this.queue(row.queue).add(row.jobName, row.payload, {
      jobId: row.jobId,
      delay,
      attempts: row.attempts || 3,
      backoff: { type: 'exponential', delay: backoffMs },
      removeOnComplete: true,
      removeOnFail: false,
    })
  }

  private async removeJob(queueName: string, jobId: string): Promise<void> {
    try {
      const job = await this.queue(queueName).getJob(jobId)
      if (job) await job.remove()
    } catch (err) {
      this.logger.warn(`Could not remove job ${jobId}: ${(err as Error).message}`)
    }
  }
}
