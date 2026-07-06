import axios from 'axios'
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { TokenQuote } from './dto'

/**
 * Thin proxy over the CoinMarketCap Pro API (mirrors mvmnt-backend's
 * CoinMarketCapService: axios + `X-CMC_PRO_API_KEY` header + the /v2 baseURL).
 *
 * Two endpoints are merged per request:
 *   - /cryptocurrency/quotes/latest → price, name, 24h %, market cap
 *   - /cryptocurrency/info          → logo URL
 *
 * Results are cached in the app's global CacheModule for 60s (keyed by the
 * sorted symbol set) to stay under CMC rate limits. Any CMC failure degrades
 * gracefully: we log and serve the last-good cache entry, or `[]` — the caller
 * (the wallet) never sees a thrown error.
 */
@Injectable()
export class CoinMarketCapService {
  private readonly apiKey = process.env.COINMARKETCAP_API_KEY
  private readonly baseURL = 'https://pro-api.coinmarketcap.com/v2/'
  private readonly cacheTtlMs = 60_000
  private readonly logger = new Logger(CoinMarketCapService.name)

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Fetch USD quotes for the given symbols. Returns `[]` (or last-good cache)
   * on any error — never throws to the caller.
   */
  async getQuotes(symbols: string[]): Promise<TokenQuote[]> {
    const normalized = Array.from(
      new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    )
    if (normalized.length === 0) return []

    const cacheKey = `market:quotes:${[...normalized].sort().join(',')}`

    const cached = await this.cache.get<TokenQuote[]>(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`)
      return cached
    }

    try {
      const csv = normalized.join(',')
      const [quotes, logos] = await Promise.all([
        this.fetchQuotes(csv),
        this.fetchLogos(csv).catch((err) => {
          // Logos are non-critical — tolerate a partial failure and continue.
          this.logger.warn(`CMC info (logos) call failed: ${err.message}`)
          return {} as Record<string, string>
        }),
      ])

      const merged = quotes.map((q) => ({ ...q, logoUrl: logos[q.symbol] }))

      await this.cache.set(cacheKey, merged, this.cacheTtlMs)
      return merged
    } catch (error) {
      this.logger.error(
        `CoinMarketCap getQuotes failed for [${normalized.join(',')}]: ${error.message}`,
        error.stack,
      )
      if (error.response) {
        this.logger.error(`CMC error response: ${JSON.stringify(error.response.data)}`)
      }
      // Degrade gracefully: last-good cache if present, else empty list.
      const lastGood = await this.cache.get<TokenQuote[]>(cacheKey)
      return lastGood ?? []
    }
  }

  /** GET /cryptocurrency/quotes/latest?symbol=<CSV>&convert=USD */
  private async fetchQuotes(csv: string): Promise<TokenQuote[]> {
    const { data } = await axios.get(`${this.baseURL}cryptocurrency/quotes/latest`, {
      params: { symbol: csv, convert: 'USD' },
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey, Accept: 'application/json' },
    })

    const bySymbol = data?.data ?? {}
    const quotes: TokenQuote[] = []

    // The v2 endpoint returns an array per symbol (multiple listings can share a
    // ticker); take the first entry, matching CMC's canonical/most-relevant pick.
    for (const symbol of Object.keys(bySymbol)) {
      const entry = Array.isArray(bySymbol[symbol]) ? bySymbol[symbol][0] : bySymbol[symbol]
      const usd = entry?.quote?.USD
      if (!entry || !usd) continue

      quotes.push({
        symbol: entry.symbol ?? symbol,
        name: entry.name ?? symbol,
        price: usd.price ?? 0,
        percentChange24h: usd.percent_change_24h ?? 0,
        marketCap: usd.market_cap ?? 0,
      })
    }

    return quotes
  }

  /** GET /cryptocurrency/info?symbol=<CSV> → { SYMBOL: logoUrl } */
  private async fetchLogos(csv: string): Promise<Record<string, string>> {
    const { data } = await axios.get(`${this.baseURL}cryptocurrency/info`, {
      params: { symbol: csv },
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey, Accept: 'application/json' },
    })

    const bySymbol = data?.data ?? {}
    const logos: Record<string, string> = {}

    for (const symbol of Object.keys(bySymbol)) {
      const entry = Array.isArray(bySymbol[symbol]) ? bySymbol[symbol][0] : bySymbol[symbol]
      if (entry?.logo) logos[entry.symbol ?? symbol] = entry.logo
    }

    return logos
  }
}
