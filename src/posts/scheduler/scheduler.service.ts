/**
 * Scheduler seam for post publishing.
 *
 * `PostScheduler` abstracts *how* a scheduled post gets fired. Today the only
 * impl is `CronScheduler` (no Redis) whose on* hooks are no-ops — a periodic
 * cron sweep drives publishing from the Postgres row (the source of truth).
 * A future `QueueScheduler` (BullMQ, gated on `REDIS_URL`) will implement the
 * same hooks to enqueue/replace/remove delayed jobs for precise firing, with
 * the cron demoted to a reconciler.
 *
 * Inject via the `POST_SCHEDULER` token, e.g.:
 *   constructor(@Inject(POST_SCHEDULER) private scheduler: PostScheduler) {}
 */

/** DI token for the active `PostScheduler` implementation. */
export const POST_SCHEDULER = Symbol('POST_SCHEDULER')

/**
 * Lifecycle hooks the PostsService calls when a post's schedule changes.
 * All are fire-and-forget — callers must not await them for correctness, since
 * the Postgres row + cron sweep already guarantee eventual publishing.
 */
export abstract class PostScheduler {
  /** A post was created/moved to `scheduled` with publish time `at`. */
  abstract onScheduled(postId: string, at: Date): void

  /** A scheduled post's publish time changed to `at`. */
  abstract onRescheduled(postId: string, at: Date): void

  /** A scheduled post was cancelled (→ draft) or otherwise no longer due. */
  abstract onCancelled(postId: string): void
}
