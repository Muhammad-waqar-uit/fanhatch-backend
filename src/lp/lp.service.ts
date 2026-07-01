import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { ETH_PRICE_USD, fansPriceUsd } from '@app/src/wallet/pricing.util'
import { LpPool } from './entities/lp-pool.entity'
import { LpPosition } from './entities/lp-position.entity'
import { FarmPosition } from './entities/farm-position.entity'
import { getAmountOut, money, priceImpactPct, sqrt } from './amm.util'
import {
  AddLiquidityDto,
  AddResultDto,
  ClaimResultDto,
  FarmDto,
  PoolDto,
  PositionDto,
  QuoteDto,
  QuoteResultDto,
  RemoveLiquidityDto,
  RemoveResultDto,
  StakeDto,
  SwapDto,
  SwapResultDto,
  UnstakeDto,
} from './dto'

/**
 * WEB3 SEAM ---------------------------------------------------------------
 * This service simulates FansSwap (the AMM: add/remove/swap/quote) and
 * StakingManager (farm stake/unstake/claim) entirely in Postgres. Every method
 * here maps 1:1 to an on-chain call; swap this class for a `*ChainService` that
 * proxies the real contracts later (mirrors the chat MembershipService seam).
 * Keep the method signatures stable so the controller never has to change.
 * -------------------------------------------------------------------------
 */
@Injectable()
export class LpService {
  constructor(
    @InjectRepository(LpPool) private readonly pools: Repository<LpPool>,
    @InjectRepository(LpPosition) private readonly positions: Repository<LpPosition>,
    @InjectRepository(FarmPosition) private readonly farms: Repository<FarmPosition>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ---- Pool / Position reads ---------------------------------------------

  async pool(): Promise<PoolDto> {
    return this.toPoolDto(await this.getPool())
  }

  async position(userId: string): Promise<PositionDto> {
    const pool = await this.getPool()
    const pos = await this.getPosition(userId)
    return this.toPositionDto(pool, pos.shares)
  }

  async farm(userId: string): Promise<FarmDto> {
    const farm = await this.getFarm(userId)
    return { staked: farm.staked, earned: farm.rewards }
  }

  // ---- Quote --------------------------------------------------------------

  async quote(dto: QuoteDto): Promise<QuoteResultDto> {
    const pool = await this.getPool()
    const reserveEth = Number(pool.reserveEth)
    const reserveFans = Number(pool.reserveFans)

    if (dto.action === 'add') {
      // Shares minted proportionally to the ETH side (matches `add`).
      const ethIn = Number(dto.ethIn ?? '0')
      const totalShares = Number(pool.totalShares)
      const sharesOut =
        totalShares > 0 && reserveEth > 0
          ? (ethIn * totalShares) / reserveEth
          : sqrt(ethIn * Number(dto.fansIn ?? '0'))
      return { sharesOut: money(sharesOut) }
    }

    // swap
    const amountIn = Number(dto.amountIn ?? '0')
    const [reserveIn, reserveOut] =
      dto.direction === 'fans_to_eth' ? [reserveFans, reserveEth] : [reserveEth, reserveFans]
    const amountOut = getAmountOut(amountIn, reserveIn, reserveOut)
    return {
      amountOut: money(amountOut),
      priceImpactPct: Number(priceImpactPct(amountIn, amountOut, reserveIn, reserveOut).toFixed(4)),
    }
  }

  // ---- Add / Remove liquidity --------------------------------------------

  async add(userId: string, dto: AddLiquidityDto): Promise<AddResultDto> {
    const ethIn = Number(dto.ethIn)
    const fansIn = Number(dto.fansIn)
    if (!(ethIn > 0) || !(fansIn > 0)) throw new BadRequestException('ethIn and fansIn must be > 0')

    const user = await this.getUser(userId)
    if (Number(user.ethBalance) < ethIn) throw new BadRequestException('Insufficient ETH balance')
    if (Number(user.fansBalance) < fansIn) throw new BadRequestException('Insufficient FANS balance')

    const pool = await this.getPool()
    const reserveEth = Number(pool.reserveEth)
    const reserveFans = Number(pool.reserveFans)
    const totalShares = Number(pool.totalShares)

    // First LP mints sqrt(eth*fans); later LPs mint proportional to the ETH side.
    const mintedShares =
      totalShares > 0 && reserveEth > 0 ? (ethIn * totalShares) / reserveEth : sqrt(ethIn * fansIn)

    // Deduct balances.
    user.ethBalance = money(Number(user.ethBalance) - ethIn)
    user.fansBalance = money(Number(user.fansBalance) - fansIn)
    await this.users.save(user)

    // Update reserves + total shares.
    pool.reserveEth = money(reserveEth + ethIn)
    pool.reserveFans = money(reserveFans + fansIn)
    pool.totalShares = money(totalShares + mintedShares)
    await this.pools.save(pool)

    // Mint the user's shares.
    const pos = await this.getPosition(userId)
    pos.shares = money(Number(pos.shares) + mintedShares)
    await this.positions.save(pos)

    return { shares: money(mintedShares), position: this.toPositionDto(pool, pos.shares) }
  }

  async remove(userId: string, dto: RemoveLiquidityDto): Promise<RemoveResultDto> {
    const burn = Number(dto.shares)
    if (!(burn > 0)) throw new BadRequestException('shares must be > 0')

    const pos = await this.getPosition(userId)
    if (Number(pos.shares) < burn) throw new BadRequestException('Insufficient LP shares')

    const pool = await this.getPool()
    const reserveEth = Number(pool.reserveEth)
    const reserveFans = Number(pool.reserveFans)
    const totalShares = Number(pool.totalShares)
    if (!(totalShares > 0)) throw new BadRequestException('Pool has no liquidity')

    const ratio = burn / totalShares
    const ethOut = reserveEth * ratio
    const fansOut = reserveFans * ratio

    // Burn shares + shrink reserves.
    pos.shares = money(Number(pos.shares) - burn)
    await this.positions.save(pos)

    pool.reserveEth = money(reserveEth - ethOut)
    pool.reserveFans = money(reserveFans - fansOut)
    pool.totalShares = money(totalShares - burn)
    await this.pools.save(pool)

    // Return the underlying to balances.
    const user = await this.getUser(userId)
    user.ethBalance = money(Number(user.ethBalance) + ethOut)
    user.fansBalance = money(Number(user.fansBalance) + fansOut)
    await this.users.save(user)

    return { ethOut: money(ethOut), fansOut: money(fansOut) }
  }

  // ---- Swap ---------------------------------------------------------------

  async swap(userId: string, dto: SwapDto): Promise<SwapResultDto> {
    const amountIn = Number(dto.amountIn)
    if (!(amountIn > 0)) throw new BadRequestException('amountIn must be > 0')

    const pool = await this.getPool()
    const reserveEth = Number(pool.reserveEth)
    const reserveFans = Number(pool.reserveFans)
    const user = await this.getUser(userId)

    const ethToFans = dto.direction === 'eth_to_fans'
    const [reserveIn, reserveOut] = ethToFans ? [reserveEth, reserveFans] : [reserveFans, reserveEth]

    // Balance guard on the input token.
    const inBalance = ethToFans ? Number(user.ethBalance) : Number(user.fansBalance)
    if (inBalance < amountIn)
      throw new BadRequestException(`Insufficient ${ethToFans ? 'ETH' : 'FANS'} balance`)

    const amountOut = getAmountOut(amountIn, reserveIn, reserveOut)
    if (dto.minOut !== undefined && amountOut < Number(dto.minOut))
      throw new BadRequestException('Slippage: output below minOut')

    // Move user balances.
    if (ethToFans) {
      user.ethBalance = money(Number(user.ethBalance) - amountIn)
      user.fansBalance = money(Number(user.fansBalance) + amountOut)
      pool.reserveEth = money(reserveEth + amountIn)
      pool.reserveFans = money(reserveFans - amountOut)
    } else {
      user.fansBalance = money(Number(user.fansBalance) - amountIn)
      user.ethBalance = money(Number(user.ethBalance) + amountOut)
      pool.reserveFans = money(reserveFans + amountIn)
      pool.reserveEth = money(reserveEth - amountOut)
    }
    await this.users.save(user)
    await this.pools.save(pool)

    return { amountOut: money(amountOut), pool: this.toPoolDto(pool) }
  }

  // ---- Farm (StakingManager) ---------------------------------------------

  async stake(userId: string, dto: StakeDto): Promise<FarmDto> {
    const amount = Number(dto.shares)
    if (!(amount > 0)) throw new BadRequestException('shares must be > 0')

    const pos = await this.getPosition(userId)
    if (Number(pos.shares) < amount) throw new BadRequestException('Insufficient LP shares to stake')

    const farm = await this.getFarm(userId)
    pos.shares = money(Number(pos.shares) - amount)
    farm.staked = money(Number(farm.staked) + amount)
    await this.positions.save(pos)
    await this.farms.save(farm)

    return { staked: farm.staked, earned: farm.rewards }
  }

  async unstake(userId: string, dto: UnstakeDto): Promise<FarmDto> {
    const amount = Number(dto.shares)
    if (!(amount > 0)) throw new BadRequestException('shares must be > 0')

    const farm = await this.getFarm(userId)
    if (Number(farm.staked) < amount) throw new BadRequestException('Insufficient staked shares')

    const pos = await this.getPosition(userId)
    farm.staked = money(Number(farm.staked) - amount)
    pos.shares = money(Number(pos.shares) + amount)
    await this.farms.save(farm)
    await this.positions.save(pos)

    return { staked: farm.staked, earned: farm.rewards }
  }

  async claim(userId: string): Promise<ClaimResultDto> {
    const farm = await this.getFarm(userId)
    const claimed = Number(farm.rewards)

    farm.rewards = money(0)
    await this.farms.save(farm)

    const user = await this.getUser(userId)
    user.fansBalance = money(Number(user.fansBalance) + claimed)
    await this.users.save(user)

    return { claimed: money(claimed), fansBalance: user.fansBalance }
  }

  // ---- internals ----------------------------------------------------------

  /** The singleton pool row — lazily created empty if the seed hasn't run yet. */
  private async getPool(): Promise<LpPool> {
    let pool = await this.pools.findOne({ where: {}, order: { created: 'ASC' } })
    if (!pool) {
      pool = await this.pools.save(
        this.pools.create({ reserveEth: money(0), reserveFans: money(0), totalShares: money(0) }),
      )
    }
    return pool
  }

  private async getPosition(userId: string): Promise<LpPosition> {
    let pos = await this.positions.findOne({ where: { userId } })
    if (!pos) pos = this.positions.create({ userId, shares: money(0) })
    return pos
  }

  private async getFarm(userId: string): Promise<FarmPosition> {
    let farm = await this.farms.findOne({ where: { userId } })
    if (!farm) farm = this.farms.create({ userId, staked: money(0), rewards: money(0) })
    return farm
  }

  private async getUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new BadRequestException('User not found')
    return user
  }

  private toPoolDto(pool: LpPool): PoolDto {
    const reserveEth = Number(pool.reserveEth)
    const reserveFans = Number(pool.reserveFans)
    const fansPerEth = reserveEth > 0 ? reserveFans / reserveEth : 0
    return {
      reserveEth: pool.reserveEth,
      reserveFans: pool.reserveFans,
      fansPerEth: money(fansPerEth),
      totalShares: pool.totalShares,
    }
  }

  private toPositionDto(pool: LpPool, shares: string): PositionDto {
    const totalShares = Number(pool.totalShares)
    const ratio = totalShares > 0 ? Number(shares) / totalShares : 0
    const ethShare = Number(pool.reserveEth) * ratio
    const fansShare = Number(pool.reserveFans) * ratio
    const valueUsd = ethShare * ETH_PRICE_USD + fansShare * fansPriceUsd(pool)
    return {
      shares: money(Number(shares)),
      ethShare: money(ethShare),
      fansShare: money(fansShare),
      valueUsd: money(valueUsd),
    }
  }
}
