/**
 * BullMQ queue names (single source of truth). Post publishing is live today;
 * cross-post + notifications are reserved for the next iteration.
 */
export const POST_PUBLISH_QUEUE = 'post-publish'

/** Reserved: fan-out a published post to external platforms (e.g. X). */
export const CROSSPOST_QUEUE = 'crosspost'

/** Reserved: deliver in-app / push notifications. */
export const NOTIFICATIONS_QUEUE = 'notifications'
