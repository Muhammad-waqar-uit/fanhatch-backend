import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** Lifecycle of a durable scheduled task row. */
export enum ScheduledTaskStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Durable task/transaction table — the source of truth behind every BullMQ job.
 *
 * A row is written PENDING before the delayed BullMQ job is enqueued, so if
 * Redis loses the job the reconciler ({@link TaskSchedulerService.reconcile})
 * can re-enqueue it from the row. `jobId` is deterministic (e.g.
 * `post:<id>:<epochMs>`) so re-enqueues dedupe against the existing BullMQ job.
 */
@Entity('scheduled_task')
@Index(['status', 'scheduledAt'])
export class ScheduledTask extends MyEntity {
  /** BullMQ queue name (see src/shared/constant/queues.ts). */
  @Column({ type: 'varchar' })
  queue: string

  /** BullMQ job name within the queue (e.g. `publish`). */
  @Column({ type: 'varchar' })
  jobName: string

  /** Deterministic, unique job id — used as the BullMQ jobId for dedupe. */
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  jobId: string

  /** Opaque job payload (e.g. `{ postId }`). */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @Column({ type: 'enum', enum: ScheduledTaskStatus, default: ScheduledTaskStatus.PENDING })
  status: ScheduledTaskStatus

  /** When the job should fire. */
  @Column({ type: 'timestamptz' })
  scheduledAt: Date

  /** BullMQ retry attempts configured for the job. */
  @Column({ type: 'int', default: 0 })
  attempts: number

  /** Last failure message (set by markFailed). */
  @Column({ type: 'text', nullable: true })
  lastError?: string | null

  /** When the job completed successfully (set by markCompleted). */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null
}
