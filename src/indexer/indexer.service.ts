import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { getAddress, type Address } from 'viem'
import { BlockchainService } from '@app/src/blockchain/blockchain.service'
import {
  CLUB_CREATED_EVENT,
  KEY_BOUGHT_EVENT,
  KEY_SOLD_EVENT,
  GIFT_EVENT,
} from '@app/src/blockchain/abis'
import { OnchainClub } from './entities/onchain-club.entity'
import { OnchainHolding } from './entities/onchain-holding.entity'
import { IndexerState } from './entities/indexer-state.entity'

/**
 * getLogs range cap. Kept at 10 to satisfy Alchemy's free-tier `eth_getLogs`
 * limit (it rejects wider ranges with "JSON is not a valid request object").
 * Raise this (e.g. to 5000) on a paid RPC to backfill far faster.
 */
const CHUNK = 10n
/** Poll cadence for new blocks once backfill has caught up. */
const POLL_MS = 15_000

/**
 * Minimal poll-based chain indexer for Fans.tech on Sepolia.
 *
 * Backfills ClubFactory.ClubCreated + per-ClubKey KeyBought/KeySold/Gift from the
 * deploy block, then polls every ~15s. Holder counts are recomputed authoritatively
 * via `readContract balanceOf` on any key event (simplest correct approach — no need
 * to replay amounts). All state lives in dedicated `onchain_*` tables so the web2
 * demo data is never touched.
 *
 * Gated: only actually syncs when `chain.enabled && RUN_WORKERS === 'true'` (worker
 * process only). Otherwise the module still loads but every poll is a no-op.
 */
@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name)
  private readonly enabled: boolean
  /** Guards against overlapping syncs (initial backfill vs. poll tick). */
  private running = false

  constructor(
    private readonly chain: BlockchainService,
    @InjectRepository(OnchainClub) private readonly clubs: Repository<OnchainClub>,
    @InjectRepository(OnchainHolding) private readonly holdings: Repository<OnchainHolding>,
    @InjectRepository(IndexerState) private readonly state: Repository<IndexerState>,
    config: ConfigService,
  ) {
    this.enabled = !!config.get<boolean>('chain.enabled') && process.env.RUN_WORKERS === 'true'
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('indexer disabled (needs chain.enabled && RUN_WORKERS=true) — poll loop no-ops')
      return
    }
    this.logger.log('indexer enabled — starting initial backfill (detached)')
    // Detached: the backfill can take minutes on a rate-limited RPC (small getLogs
    // ranges). Awaiting it here would block app bootstrap / HTTP listen. sync() catches
    // its own errors and the `running` guard keeps the @Interval poll from overlapping.
    void this.sync()
  }

  /** Poll tick. No-ops unless gated on. */
  @Interval('chain-indexer', POLL_MS)
  async poll(): Promise<void> {
    if (!this.enabled) return
    await this.sync()
  }

  /** Backfill/poll from the cursor to chain head, in CHUNK-sized ranges. */
  private async sync(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const st = await this.getState()
      const head = await this.chain.client.getBlockNumber()
      const deploy = this.chain.deployBlock
      let from = st.lastBlock === null ? deploy : BigInt(st.lastBlock) + 1n
      if (from < deploy) from = deploy
      if (from > head) return

      for (let start = from; start <= head; start += CHUNK) {
        const end = start + CHUNK - 1n < head ? start + CHUNK - 1n : head
        await this.indexRange(start, end)
        await this.saveLastBlock(end)
        this.logger.log(`indexed blocks [${start} … ${end}] — lastBlock=${end}`)
      }
    } catch (e) {
      // Keep the loop alive: transient RPC errors retry on the next tick from the same cursor.
      this.logger.error(`sync failed: ${(e as Error).message}`)
    } finally {
      this.running = false
    }
  }

  /** Index every relevant event in [from, to] and reconcile affected holders. */
  private async indexRange(from: bigint, to: bigint): Promise<void> {
    // 1. New clubs (ClubFactory.ClubCreated).
    const created = await this.chain.client.getLogs({
      address: this.chain.addresses.clubFactory,
      event: CLUB_CREATED_EVENT,
      fromBlock: from,
      toBlock: to,
    })
    for (const log of created) {
      const { clubId, creator, ticker, curveType, clubKey } = log.args
      await this.clubs.upsert(
        {
          clubId: (clubId as bigint).toString(),
          clubKey: getAddress(clubKey as Address),
          creator: getAddress(creator as Address),
          ticker: ticker as string,
          curveType: Number(curveType),
          createdAtBlock: log.blockNumber.toString(),
        },
        ['clubKey'],
      )
    }

    // 2. Key events across every known ClubKey (includes clubs just created above,
    //    so the creator's free first-key KeyBought in the same range is caught).
    const keys = (await this.clubs.find({ select: { clubKey: true } })).map(
      (c) => getAddress(c.clubKey as Address),
    )
    if (keys.length === 0) return

    // clubKey -> set of holder addresses whose balance may have changed.
    const affected = new Map<Address, Set<Address>>()
    const touch = (clubKey: Address, holder: Address) => {
      const set = affected.get(clubKey) ?? new Set<Address>()
      set.add(getAddress(holder))
      affected.set(clubKey, set)
    }

    for (const event of [KEY_BOUGHT_EVENT, KEY_SOLD_EVENT, GIFT_EVENT]) {
      const logs = await this.chain.client.getLogs({ address: keys, event, fromBlock: from, toBlock: to })
      for (const log of logs) {
        const a = log.args as { buyer?: Address; seller?: Address; from?: Address; to?: Address }
        const clubKey = getAddress(log.address)
        if (a.buyer) touch(clubKey, a.buyer)
        if (a.seller) touch(clubKey, a.seller)
        if (a.from) touch(clubKey, a.from)
        if (a.to) touch(clubKey, a.to)
      }
    }

    // 3. Recompute each touched holder's authoritative key count and upsert.
    for (const [clubKey, holders] of affected) {
      for (const holder of holders) {
        const balance = await this.chain.clubKeyBalance(clubKey, holder)
        await this.holdings.upsert(
          { clubKey, holder, keyCount: balance.toString() },
          ['clubKey', 'holder'],
        )
      }
    }
  }

  /** Fetch (or lazily create) the single cursor row. */
  private async getState(): Promise<IndexerState> {
    let st = await this.state.findOne({ where: { id: 1 } })
    if (!st) {
      st = this.state.create({ id: 1, lastBlock: null })
      await this.state.save(st)
    }
    return st
  }

  private async saveLastBlock(block: bigint): Promise<void> {
    await this.state.upsert({ id: 1, lastBlock: block.toString() }, ['id'])
  }
}
