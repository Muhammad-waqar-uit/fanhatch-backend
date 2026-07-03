/**
 * Minimal viem ABIs — only the fragments the app actually calls.
 * The indexer adds event fragments (ClubCreated / KeyBought / …) as it needs them.
 */
export const ERC20_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

/** ClubKey exposes ERC20-style `balanceOf` (key count) — used by the future on-chain gating swap. */
export const CLUB_KEY_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

// --- Event fragments the indexer filters on (signatures mirror the deployed contracts). ---

/** ClubFactory.ClubCreated — one per club, carries the deployed ClubKey proxy address. */
export const CLUB_CREATED_EVENT = {
  type: 'event',
  name: 'ClubCreated',
  inputs: [
    { name: 'clubId', type: 'uint256', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'ticker', type: 'string', indexed: false },
    { name: 'curveType', type: 'uint8', indexed: false },
    { name: 'clubKey', type: 'address', indexed: false },
  ],
} as const

/** ClubKey.KeyBought — emitted on buy and on the creator's free first key (initialize). */
export const KEY_BOUGHT_EVENT = {
  type: 'event',
  name: 'KeyBought',
  inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'price', type: 'uint256', indexed: false },
  ],
} as const

/** ClubKey.KeySold. */
export const KEY_SOLD_EVENT = {
  type: 'event',
  name: 'KeySold',
  inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'proceeds', type: 'uint256', indexed: false },
  ],
} as const

/** ClubKey.Gift — free transfer of keys between holders. */
export const GIFT_EVENT = {
  type: 'event',
  name: 'Gift',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
} as const

/** All ClubKey balance-changing events — scanned together across every known ClubKey. */
export const CLUB_KEY_EVENTS = [KEY_BOUGHT_EVENT, KEY_SOLD_EVENT, GIFT_EVENT] as const
