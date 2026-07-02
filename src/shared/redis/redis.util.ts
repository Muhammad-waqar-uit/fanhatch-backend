/**
 * Redis connection helpers shared by BullMQ (queues + workers).
 *
 * The whole durable-jobs stack is gated on `REDIS_URL`: when it's unset the app
 * still boots on the Redis-free `CronScheduler` fallback, so these helpers are
 * the single place that reads/parses the URL.
 */
import type { RedisOptions } from 'ioredis'

/** True iff a Redis connection is configured (BullMQ + reconciler are wired only then). */
export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL && process.env.REDIS_URL.trim().length > 0
}

/**
 * ioredis connection options parsed from `REDIS_URL`.
 *
 * `maxRetriesPerRequest: null` + `enableReadyCheck: false` are the BullMQ-required
 * settings for the blocking connection its workers use. `rediss://` enables TLS.
 */
export function getRedisConnection(): RedisOptions {
  const url = new URL(process.env.REDIS_URL as string)
  const db = url.pathname && url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isNaN(db) ? 0 : db,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
}
