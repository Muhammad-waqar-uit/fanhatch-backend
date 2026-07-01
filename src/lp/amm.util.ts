/**
 * Constant-product AMM math (web2 mirror of FansSwap's UniswapV2-style pair).
 * All inputs/outputs are decimal strings; math runs in JS numbers (fine for the
 * simulation) and is re-formatted to 8dp to match the `numeric(_,8)` columns.
 */

/** 8dp formatting to match the numeric(30,8) columns. */
export const money = (n: number): string => n.toFixed(8)

/** Babylonian sqrt — used for the first LP's minted shares (`sqrt(eth * fans)`). */
export function sqrt(value: number): number {
  return Math.sqrt(value)
}

/**
 * Constant-product output with a 0.3% fee:
 * `out = amountIn*997*reserveOut / (reserveIn*1000 + amountIn*997)`.
 */
export function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0
  const amountInWithFee = amountIn * 997
  const numerator = amountInWithFee * reserveOut
  const denominator = reserveIn * 1000 + amountInWithFee
  return numerator / denominator
}

/**
 * Price impact of a swap, as a percentage: how far the effective execution price
 * moves from the pre-trade spot price.
 */
export function priceImpactPct(
  amountIn: number,
  amountOut: number,
  reserveIn: number,
  reserveOut: number,
): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0
  const spotPrice = reserveOut / reserveIn // out per in, before the trade
  const execPrice = amountOut / amountIn // out per in, actually received
  return (1 - execPrice / spotPrice) * 100
}
