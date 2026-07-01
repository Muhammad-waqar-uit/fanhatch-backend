import { LpPool } from '@app/src/lp/entities/lp-pool.entity'

/**
 * Web2 pricing constants + helpers. On-chain these come from an oracle + the
 * FansSwap pool spot price; for now ETH is a fixed USD constant and FANS is
 * derived from the pool reserve ratio.
 */

/** Fixed ETH price in USD for the web2 simulation. */
export const ETH_PRICE_USD = 3000

/** Fallback FANS price (USD) when the pool is empty/unseeded. */
export const FANS_PRICE_FALLBACK_USD = 0.03

/**
 * FANS price in USD, derived from the pool ratio:
 * `reserveEth * ETH_PRICE_USD / reserveFans`. Falls back to 0.03 when the pool
 * has no liquidity.
 */
export function fansPriceUsd(pool?: LpPool | null): number {
  if (!pool) return FANS_PRICE_FALLBACK_USD
  const reserveEth = Number(pool.reserveEth)
  const reserveFans = Number(pool.reserveFans)
  if (!(reserveFans > 0) || !(reserveEth > 0)) return FANS_PRICE_FALLBACK_USD
  return (reserveEth * ETH_PRICE_USD) / reserveFans
}
