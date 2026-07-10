import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createPublicClient, http, getAddress, type Address } from 'viem'
import { ERC20_ABI, CLUB_KEY_ABI } from './abis'

type ChainConfig = {
  rpcUrl: string
  chainId: number
  deployBlock: number
  addresses: Record<string, string>
}

/**
 * Thin viem provider over the deployed Fanhatch contracts. Exposes the public
 * client + checksummed addresses for the indexer, plus a couple of read helpers
 * the on-chain gating swap will use. Read-only — signing lives on the frontend.
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name)
  // Inferred type (not the bare `PublicClient`) so viem's readContract stays correctly typed.
  readonly client: ReturnType<typeof createPublicClient>
  readonly addresses: Record<string, Address>
  readonly chainId: number
  readonly deployBlock: bigint

  constructor(config: ConfigService) {
    const c = config.getOrThrow<ChainConfig>('chain')
    this.chainId = c.chainId
    this.deployBlock = BigInt(c.deployBlock)
    this.addresses = Object.fromEntries(
      Object.entries(c.addresses).map(([k, v]) => [k, getAddress(v)]),
    ) as Record<string, Address>
    this.client = createPublicClient({ transport: http(c.rpcUrl) })
  }

  /**
   * Single contained cast: viem 2.21's `ReadContractParameters` wrongly requires
   * `authorizationList` (EIP-7702) for plain view reads — a type bug, runtime is fine.
   * ponytail: one `as never` here beats casting every call site; drop it once viem fixes the type.
   */
  private read<T>(address: Address, abi: unknown, functionName: string, args?: unknown[]): Promise<T> {
    return this.client.readContract({ address, abi, functionName, args } as never) as Promise<T>
  }

  /** Startup health: proves the RPC + $FANS address + ABI are all wired. Non-fatal. */
  async onModuleInit(): Promise<void> {
    try {
      const [name, symbol, supply, block] = await Promise.all([
        this.read<string>(this.addresses.fans, ERC20_ABI, 'name'),
        this.read<string>(this.addresses.fans, ERC20_ABI, 'symbol'),
        this.read<bigint>(this.addresses.fans, ERC20_ABI, 'totalSupply'),
        this.client.getBlockNumber(),
      ])
      this.logger.log(`chain ${this.chainId} @ block ${block} — $FANS: ${name} (${symbol}) supply=${supply}`)
    } catch (e) {
      this.logger.warn(`chain read failed (chainId ${this.chainId}): ${(e as Error).message}`)
    }
  }

  fansBalance(user: Address): Promise<bigint> {
    return this.read<bigint>(this.addresses.fans, ERC20_ABI, 'balanceOf', [user])
  }

  /** Key count a user holds for a given club's ClubKey contract. */
  clubKeyBalance(clubKey: Address, user: Address): Promise<bigint> {
    return this.read<bigint>(clubKey, CLUB_KEY_ABI, 'balanceOf', [user])
  }
}
