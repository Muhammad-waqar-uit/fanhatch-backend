/**
 * Notification domain enums (Fans.tech).
 *
 * These are the single source of truth for notification typing across the
 * entity, service, gateway and DTOs. `NotificationRelatedTo` also drives the
 * FE tabs + deep-link routing, so its lowercased values are the keys of the
 * unread-count map returned by `GET /notifications/unread-count`.
 */

/** Dispatch-time event that produced a notification. */
export enum NotificationType {
  KEY_BOUGHT = 'KEY_BOUGHT',
  KEY_SOLD = 'KEY_SOLD',
  GIFT_RECEIVED = 'GIFT_RECEIVED',
  CLUB_CREATED = 'CLUB_CREATED',
  VOTE_RECEIVED = 'VOTE_RECEIVED',
  PRESIDENT_ELECTED = 'PRESIDENT_ELECTED',
  FOLLOWED = 'FOLLOWED',
  POST_PUBLISHED = 'POST_PUBLISHED',
  POST_LIKED = 'POST_LIKED',
  MENTIONED = 'MENTIONED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SWAP_EXECUTED = 'SWAP_EXECUTED',
  STAKE_REWARD = 'STAKE_REWARD',
  WELCOME = 'WELCOME',
}

/** Read lifecycle. `DELETED` is a soft-delete tombstone (never surfaced). */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  DELETED = 'DELETED',
}

/** Grouping that drives FE tabs + deep-link. Lowercased → unread-count keys. */
export enum NotificationRelatedTo {
  CLUB = 'CLUB',
  KEY = 'KEY',
  POST = 'POST',
  CHAT = 'CHAT',
  GIFT = 'GIFT',
  VOTE = 'VOTE',
  SWAP = 'SWAP',
  STAKE = 'STAKE',
  USER = 'USER',
}

/** Recipient kind. `USER` is the only live value; kept for parity/future ADMIN. */
export enum NotificationReceiverType {
  USER = 'USER',
}

/** User-toggleable preference buckets. System types (WELCOME) always deliver. */
export enum NotificationSettingType {
  KEY_ACTIVITY = 'KEY_ACTIVITY',
  GIFTS = 'GIFTS',
  GOVERNANCE = 'GOVERNANCE',
  NEW_POSTS = 'NEW_POSTS',
  SOCIAL = 'SOCIAL',
  WALLET = 'WALLET',
}
