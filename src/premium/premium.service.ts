import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserPlan } from '@app/shared/enums'
import { User } from '@app/src/users/user.entity'
import type { PlanDto, SubscriptionDto } from './dto'

/** Static plan catalog (mirrors the Premium screen / figma). */
const PLANS: PlanDto[] = [
  {
    id: UserPlan.FREE,
    name: 'Free',
    price: 0,
    period: 'Forever',
    features: [
      'Built-in crypto wallet',
      'Basic posting tools',
      'Manual cross-posting',
      'Reads access',
      'Basic trading features',
      '1GB media storage',
      'Standard platform fees',
    ],
  },
  {
    id: UserPlan.PREMIUM,
    name: 'Premium',
    price: 250,
    period: 'Per year',
    features: [
      'Automated cross-posting',
      'Post scheduling',
      'Drafts & templates',
      'Zero trading fees',
      '50GB media storage',
      'Custom profile themes',
      'Early access to new features',
    ],
  },
  {
    id: UserPlan.PRO,
    name: 'Pro',
    price: 873,
    period: 'Per year',
    features: [
      'Fans.tech Studio',
      'Long-form publishing & tipping',
      'Cross-platform Ads Suite',
      'Create & manage paid campaigns',
      'Zero platform fees',
      '150GB media storage',
      'Advanced analytics dashboard',
      'Priority support',
    ],
  },
]

@Injectable()
export class PremiumService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  getPlans(): PlanDto[] {
    return PLANS
  }

  async getSubscription(userId: string): Promise<SubscriptionDto> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return { plan: user.plan, since: user.planSince?.toISOString() ?? null }
  }

  // ponytail: no billing gateway — selecting a plan just records the tier. Wire real payment later.
  async subscribe(userId: string, planId: UserPlan): Promise<SubscriptionDto> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    user.plan = planId
    user.planSince = new Date()
    await this.users.save(user)
    return { plan: user.plan, since: user.planSince.toISOString() }
  }
}
