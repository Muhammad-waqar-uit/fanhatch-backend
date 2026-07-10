import { UserPlan } from '@app/shared/enums'

/**
 * Machine-checkable plan capabilities — the single source of truth for
 * enforcement (separate from the display catalog in premium.service). Add a
 * key here, then check it at the action (value limits inline, booleans via a
 * @RequiresPlan guard). Mirrors the figma "Select a plan" features.
 */
export interface PlanEntitlements {
  /** Media storage allowance in GiB. */
  storageGb: number
  scheduling: boolean
  drafts: boolean
  autoCrossPost: boolean
  customThemes: boolean
  earlyAccess: boolean
  zeroTradingFees: boolean
  zeroPlatformFees: boolean
  studio: boolean
  adsSuite: boolean
  analytics: boolean
  tipping: boolean
}

export const PLAN_ENTITLEMENTS: Record<UserPlan, PlanEntitlements> = {
  [UserPlan.FREE]: {
    storageGb: 1,
    scheduling: false,
    drafts: false,
    autoCrossPost: false,
    customThemes: false,
    earlyAccess: false,
    zeroTradingFees: false,
    zeroPlatformFees: false,
    studio: false,
    adsSuite: false,
    analytics: false,
    tipping: false,
  },
  [UserPlan.PREMIUM]: {
    storageGb: 50,
    scheduling: true,
    drafts: true,
    autoCrossPost: true,
    customThemes: true,
    earlyAccess: true,
    zeroTradingFees: true,
    zeroPlatformFees: false,
    studio: false,
    adsSuite: false,
    analytics: false,
    tipping: false,
  },
  [UserPlan.PRO]: {
    storageGb: 150,
    scheduling: true,
    drafts: true,
    autoCrossPost: true,
    customThemes: true,
    earlyAccess: true,
    zeroTradingFees: true,
    zeroPlatformFees: true,
    studio: true,
    adsSuite: true,
    analytics: true,
    tipping: true,
  },
}

const GIB = 1024 ** 3

export function storageLimitBytes(plan: UserPlan): number {
  return (PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS[UserPlan.FREE]).storageGb * GIB
}

export function hasFeature(plan: UserPlan, feature: keyof PlanEntitlements): boolean {
  return Boolean((PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS[UserPlan.FREE])[feature])
}
