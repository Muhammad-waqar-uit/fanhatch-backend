import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { LpPool } from '@app/src/lp/entities/lp-pool.entity'
import { FarmPosition } from '@app/src/lp/entities/farm-position.entity'
import { ETH_PRICE_USD, fansPriceUsd } from './pricing.util'
import {
  ClaimResultDto,
  ClaimRewardsDto,
  KeyHoldingDto,
  WalletOverviewDto,
  WalletRewardsDto,
} from './dto'

/** 8dp money formatting, matching the numeric(_,8) columns. */
const money = (n: number): string => n.toFixed(8)

/**
 * Simple deterministic web2 accrual for a creator's clubs: each key sold beyond
 * the creator's own free key #1 accrues a flat 0.1 FANS. Kept intentionally
 * simple/seeded — on-chain this comes from the club fee split.
 */
const CLUB_REWARD_PER_KEY = 0.1

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @InjectRepository(LpPool) private readonly pools: Repository<LpPool>,
    @InjectRepository(FarmPosition) private readonly farms: Repository<FarmPosition>,
  ) {}

  // ---- Overview -----------------------------------------------------------

  async overview(userId: string): Promise<WalletOverviewDto> {
    const user = await this.getUser(userId)
    const pool = await this.getPool()
    const fansPrice = fansPriceUsd(pool)

    const keys = await this.keys(userId)
    const keysValueFans = keys.reduce((sum, k) => sum + k.keyCount * Number(k.keyPrice), 0)

    const eth = Number(user.ethBalance)
    const fans = Number(user.fansBalance)
    const ethUsd = eth * ETH_PRICE_USD
    const fansUsd = fans * fansPrice
    const keysUsd = keysValueFans * fansPrice

    // Net worth = eth*ETH_PRICE + fans*FANS_PRICE + Σ(keyCount*keyPrice)*FANS_PRICE
    const netWorthUsd = ethUsd + fansUsd + keysUsd

    const rewards = await this.rewards(userId)

    return {
      netWorthUsd: money(netWorthUsd),
      change24hPct: 0, // web2 stub — no historical snapshots yet
      fansPriceUsd: money(fansPrice),
      balances: {
        eth: money(eth),
        ethUsd: money(ethUsd),
        fans: money(fans),
        fansUsd: money(fansUsd),
      },
      keys: {
        count: keys.reduce((sum, k) => sum + k.keyCount, 0),
        valueUsd: money(keysUsd),
      },
      rewards: { farm: rewards.farmRewards, club: rewards.clubRewards },
    }
  }

  // ---- Keys ---------------------------------------------------------------

  async keys(userId: string): Promise<KeyHoldingDto[]> {
    const holdings = await this.holdings.find({ where: { userId } })
    if (!holdings.length) return []

    const clubs = await this.clubs.find({ where: { id: In(holdings.map((h) => h.clubId)) } })
    const byId = new Map(clubs.map((c) => [c.id, c]))
    const fansPrice = fansPriceUsd(await this.getPool())

    return holdings
      .map((h) => {
        const club = byId.get(h.clubId)
        if (!club) return null
        const valueUsd = h.keyCount * Number(club.keyPrice) * fansPrice
        return {
          clubId: club.id,
          ftId: club.ftId,
          name: club.name,
          ticker: club.ticker,
          keyCount: h.keyCount,
          keyPrice: club.keyPrice,
          valueUsd: money(valueUsd),
        }
      })
      .filter((k): k is KeyHoldingDto => k !== null)
  }

  // ---- Rewards ------------------------------------------------------------

  async rewards(userId: string): Promise<WalletRewardsDto> {
    const farm = await this.farms.findOne({ where: { userId } })
    const farmRewards = farm ? Number(farm.rewards) : 0
    const clubRewards = await this.clubRewards(userId)

    return {
      farmRewards: money(farmRewards),
      clubRewards: money(clubRewards),
      claimable: money(farmRewards + clubRewards),
    }
  }

  /** POST /wallet/rewards/claim — adds the claimed amount to fansBalance. */
  async claim(userId: string, dto: ClaimRewardsDto): Promise<ClaimResultDto> {
    const user = await this.getUser(userId)

    let claimed = 0
    if (dto.type === 'farm') {
      const farm = await this.farms.findOne({ where: { userId } })
      claimed = farm ? Number(farm.rewards) : 0
      if (farm) {
        farm.rewards = money(0)
        await this.farms.save(farm)
      }
    } else {
      // club
      claimed = await this.clubRewards(userId)
    }

    if (!(claimed > 0)) throw new BadRequestException('Nothing to claim')

    user.fansBalance = money(Number(user.fansBalance) + claimed)
    await this.users.save(user)

    return { claimed: money(claimed), fansBalance: user.fansBalance }
  }

  // ---- internals ----------------------------------------------------------

  /** Creator-side accrual across all clubs the user owns (supply-based, seeded). */
  private async clubRewards(userId: string): Promise<number> {
    const clubs = await this.clubs.find({ where: { creatorId: userId } })
    return clubs.reduce((sum, c) => sum + Math.max(0, c.supply - 1) * CLUB_REWARD_PER_KEY, 0)
  }

  private async getUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  /** The singleton LP pool row (used only for the FANS price). */
  private async getPool(): Promise<LpPool | null> {
    return this.pools.findOne({ where: {}, order: { created: 'ASC' } })
  }
}
