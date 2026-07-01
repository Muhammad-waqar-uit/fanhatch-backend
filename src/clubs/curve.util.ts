/**
 * Web2 bonding-curve estimate — a pure function used to simulate key pricing in
 * Postgres. The on-chain curve (Phase 2) is the real source of truth; this only
 * powers the create-club price picker and the web2 buy simulation.
 *
 *   casual   → base + 0.001·n   (gentle, linear-low)
 *   standard → base + 0.004·n   (medium, linear-high)
 *   exclusive→ base · 1.008^n   (steep, exponential)
 *
 * `base = 0.01`; the first key is free (supply starts at 1).
 */
export type CurveType = 'casual' | 'standard' | 'exclusive'

const BASE = 0.01

export function estimatePrice(curveType: CurveType, supply: number): number {
  const n = Math.max(0, supply)
  switch (curveType) {
    case 'casual':
      return BASE + 0.001 * n
    case 'standard':
      return BASE + 0.004 * n
    case 'exclusive':
      return BASE * Math.pow(1.008, n)
    default:
      return BASE
  }
}
