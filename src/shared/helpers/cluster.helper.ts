/**
 * Cluster / multi-worker awareness.
 *
 * Cron emitters guard on `isPrimaryWorker()` so a scheduled sweep fires exactly
 * once even when the app runs N processes under pm2 cluster mode. Single-instance
 * dev (no pm2) is always primary. When the BullMQ `QueueScheduler` lands, queue
 * *execution* runs on every worker and won't need this guard — Redis gives
 * exactly-once semantics on the job itself.
 */

/**
 * True on the process that should run singleton cron work.
 *
 * Under pm2 cluster mode, `NODE_APP_INSTANCE` / `pm_id` identify the worker;
 * only instance `0` is treated as primary. Outside pm2 (plain `node`, dev,
 * tests) both are undefined → always primary.
 */
export function isPrimaryWorker(): boolean {
  const instance = process.env.NODE_APP_INSTANCE ?? process.env.pm_id
  if (instance === undefined) return true
  return instance === '0'
}
