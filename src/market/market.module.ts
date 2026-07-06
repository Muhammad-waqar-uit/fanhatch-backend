import { Module } from '@nestjs/common'
import { MarketController } from './market.controller'
import { CoinMarketCapService } from './coin-market-cap.service'

/**
 * Market module — proxies CoinMarketCap for token prices. Relies on the global
 * CacheModule (registered in app.module) for its 60s quote cache. The
 * orchestrator registers this module in app.module.
 */
@Module({
  controllers: [MarketController],
  providers: [CoinMarketCapService],
  exports: [CoinMarketCapService],
})
export class MarketModule {}
