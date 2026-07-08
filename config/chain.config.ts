/**
 * On-chain config — Fans.tech contracts on Ethereum Sepolia (Phase 2 / web3).
 * Enabled only when CHAIN_RPC_URL is set; otherwise the app stays fully web2.
 */
export default () => ({
  chain: {
    enabled: !!process.env.CHAIN_RPC_URL,
    rpcUrl: process.env.CHAIN_RPC_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
    // Block the contracts were deployed at — the indexer backfills from here.
    deployBlock: parseInt(process.env.CHAIN_DEPLOY_BLOCK || '11193463', 10),
    // Deployed addresses (Sepolia). Override per-network via env if needed.
    addresses: {
      fans: process.env.ADDR_FANS || '0xeaD4ea56B35Db340F0d8E9fc21929994751e3AeA',
      feeDistributor: process.env.ADDR_FEE_DISTRIBUTOR || '0xfb8d90D93fB43bCDde37b40151BE088EFc5ee10E',
      clubFactory: process.env.ADDR_CLUB_FACTORY || '0x85Eb6F843E17D5b11127791678A6c9A457Ae516f',
      clubKeyBeacon: process.env.ADDR_CLUB_KEY_BEACON || '0x5205905477DA696088Ec24Ee091000ab3d4698c4',
      governanceModule: process.env.ADDR_GOVERNANCE || '0xF217867fb25bE6f22B99eDA2399d9f4D01323b56',
      // FansSwap = deprecated custom AMM; swaps/LP now run on the Uniswap v4 pool below.
      fansSwap: process.env.ADDR_FANS_SWAP || '0x8B37DCFBd1fBcA862bF45B81D9Ba4FbC057d6510',
      stakingFans: process.env.ADDR_STAKING_FANS || '0xc7909d54003DdfDDEFa769EEEEd713312d29679B',
      stakingLp: process.env.ADDR_STAKING_LP || '0xF4A8F3c8ac866551B1aAa78cF19C238D7243BC3b',
      // Uniswap v4 (Sepolia) — swap via router, LP via the ERC-20 vault (FANS-LP).
      poolManager: process.env.ADDR_POOL_MANAGER || '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
      fansHook: process.env.ADDR_FANS_HOOK || '0xB2015C1c323d22D68E06042EB9A70a3b4f7760CC',
      fansV4Router: process.env.ADDR_FANS_V4_ROUTER || '0x19dbb0CBbf6910D39a6513f36E8CDC418f586545',
      fansLpVault: process.env.ADDR_FANS_LP_VAULT || '0x96bC0735c79666a68d779584974e1F93F42F0Df9',
    },
  },
})
