import { NotificationType, NotificationSettingType } from '../enums'

/**
 * Map dispatch-time {@link NotificationType} → user-toggleable
 * {@link NotificationSettingType}.
 *
 * Only types listed here are gated by the recipient's notification settings:
 * when a recipient's setting row for the mapped bucket has `status=false`,
 * `NotificationsService.create` skips the insert entirely. Anything NOT mapped
 * here always delivers — those are system notifications (WELCOME, CLUB_CREATED),
 * not "preferences".
 *
 * If you add a new user-facing toggle, wire the corresponding NotificationType(s)
 * here so the toggle actually controls dispatch — there is no automatic matching.
 */
export const NOTIFICATION_TYPE_TO_SETTING: Partial<
  Record<NotificationType, NotificationSettingType>
> = {
  [NotificationType.KEY_BOUGHT]: NotificationSettingType.KEY_ACTIVITY,
  [NotificationType.KEY_SOLD]: NotificationSettingType.KEY_ACTIVITY,

  [NotificationType.GIFT_RECEIVED]: NotificationSettingType.GIFTS,

  [NotificationType.VOTE_RECEIVED]: NotificationSettingType.GOVERNANCE,
  [NotificationType.PRESIDENT_ELECTED]: NotificationSettingType.GOVERNANCE,

  [NotificationType.POST_PUBLISHED]: NotificationSettingType.NEW_POSTS,

  [NotificationType.FOLLOWED]: NotificationSettingType.SOCIAL,
  [NotificationType.POST_LIKED]: NotificationSettingType.SOCIAL,
  [NotificationType.MENTIONED]: NotificationSettingType.SOCIAL,
  [NotificationType.NEW_MESSAGE]: NotificationSettingType.SOCIAL,

  [NotificationType.SWAP_EXECUTED]: NotificationSettingType.WALLET,
  [NotificationType.STAKE_REWARD]: NotificationSettingType.WALLET,

  // CLUB_CREATED + WELCOME are intentionally unmapped → always deliver.
}
