import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import type { ReferralMeDto, ReferralRewardDto } from './dto'

/** Static reward tiles shown on the Referrals screen (figma). */
const REWARDS: ReferralRewardDto[] = [
  { key: 'usdt', label: '$10 USDT', sub: 'For every successful referral' },
  { key: 'bonus', label: '150', sub: 'Token bonus' },
  { key: 'fees', label: '15%', sub: 'Trading fees for you' },
  { key: 'friend', label: '30% off', sub: 'Trading fees for your friend for 1 year' },
]

/** Base for the shareable referral link (cosmetic). */
const LINK_BASE = process.env.REFERRAL_LINK_BASE ?? 'https://fans.tech'

@Injectable()
export class ReferralsService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Deterministic per-user code from the uuid (no randomness → collision-safe). */
  private codeFor(user: User): string {
    return `FANS${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
  }

  async getMine(userId: string): Promise<ReferralMeDto> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.referralCode) {
      user.referralCode = this.codeFor(user)
      await this.users.save(user)
    }
    const invited = await this.users.count({ where: { referredById: user.id } })
    return {
      code: user.referralCode,
      link: `${LINK_BASE}/join/${user.referralCode}`,
      rewards: REWARDS,
      // ponytail: rewards are computed for display — no USDT payout yet.
      stats: { invited, rewardsUsdt: invited * 10, tokenBonus: invited * 150 },
    }
  }

  async redeem(userId: string, rawCode: string): Promise<{ success: true }> {
    const code = rawCode.trim().toUpperCase()
    if (!code) throw new BadRequestException('Code required')
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (user.referredById) throw new BadRequestException('You have already used a referral code')
    const owner = await this.users.findOne({ where: { referralCode: code } })
    if (!owner) throw new NotFoundException('Unknown referral code')
    if (owner.id === user.id) throw new BadRequestException('You cannot use your own code')
    user.referredById = owner.id
    await this.users.save(user)
    return { success: true }
  }
}
