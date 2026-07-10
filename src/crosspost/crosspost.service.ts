import { Injectable, Logger } from '@nestjs/common'
import { postToKick } from './providers/kick.provider'
import { postToX } from './providers/x.provider'

export type CrossPostPlatform = 'x' | 'kick' | 'instagram' | 'linkedin' | 'farcaster' | 'lens'

export interface CrossPostResult {
  platform: string
  status: 'sent' | 'skipped' | 'failed'
  detail?: string
}

/** A user's connected external account (populated by the future OAuth connect flow). */
export interface SocialConnection {
  accessToken: string
  /** Platform-specific target id — Kick `broadcaster_user_id`. */
  externalId?: string
}

/**
 * App-level credentials that gate each platform. Empty until we register the
 * developer apps — a platform with missing keys reports `skipped: not configured`.
 * Priority now is X + Kick (the confirmed requirement); the rest are placeholders.
 */
const PLATFORM_ENV: Record<CrossPostPlatform, string[]> = {
  x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  kick: ['KICK_CLIENT_ID', 'KICK_CLIENT_SECRET'],
  instagram: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  farcaster: ['FARCASTER_API_KEY'],
  lens: ['LENS_API_KEY'],
}

@Injectable()
export class CrossPostService {
  private readonly logger = new Logger(CrossPostService.name)

  isConfigured(platform: string): boolean {
    const keys = PLATFORM_ENV[platform as CrossPostPlatform]
    return Array.isArray(keys) && keys.length > 0 && keys.every((k) => !!process.env[k])
  }

  /**
   * SEAM: the user's connected account for a platform. Returns null until the
   * OAuth connect flow + `social_connections` table exist. Wire that here — the
   * provider calls below are already correct and will activate automatically.
   * ponytail: read from social_connections once the connect flow is built.
   */
  private async getConnection(_userId: string, _platform: string): Promise<SocialConnection | null> {
    return null
  }

  /**
   * Mirror a published post to the selected platforms. Fire-and-forget — never
   * blocks the request. X posts a tweet; Kick posts a chat message to the user's
   * channel. Everything reports `skipped` until app keys + a user connection exist.
   */
  async dispatch(
    post: { id: string; body: string; authorId: string },
    targets: string[] | null | undefined,
  ): Promise<CrossPostResult[]> {
    const list = (targets ?? []).filter(Boolean)
    if (list.length === 0) return []
    const results = await Promise.all(list.map((p) => this.postOne(p, post)))
    const sent = results.filter((r) => r.status === 'sent').length
    this.logger.log(`post ${post.id}: cross-post ${sent}/${results.length} sent`)
    return results
  }

  private async postOne(
    platform: string,
    post: { id: string; body: string; authorId: string },
  ): Promise<CrossPostResult> {
    if (!this.isConfigured(platform)) {
      return { platform, status: 'skipped', detail: 'not configured (no app credentials yet)' }
    }
    const conn = await this.getConnection(post.authorId, platform)
    if (!conn) {
      return { platform, status: 'skipped', detail: 'user account not connected' }
    }
    try {
      if (platform === 'x') {
        const { id } = await postToX(conn.accessToken, post.body)
        return { platform, status: 'sent', detail: id }
      }
      if (platform === 'kick') {
        const { messageId } = await postToKick(conn.accessToken, Number(conn.externalId), post.body)
        return { platform, status: 'sent', detail: messageId }
      }
      return { platform, status: 'skipped', detail: 'provider not implemented yet' }
    } catch (err) {
      return { platform, status: 'failed', detail: (err as Error).message }
    }
  }
}
