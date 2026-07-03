import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OnchainClub } from './entities/onchain-club.entity'
import { OnchainHolding } from './entities/onchain-holding.entity'
import { IndexerState } from './entities/indexer-state.entity'
import { IndexerService } from './indexer.service'

/**
 * On-chain event indexer. Registered in AppModule only when
 * `CHAIN_RPC_URL && RUN_WORKERS === 'true'` (worker process), so API replicas
 * never run the poll loop. Relies on the @Global BlockchainModule for the client.
 * ScheduleModule.forRoot() (AppModule) picks up the @Interval poll.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OnchainClub, OnchainHolding, IndexerState])],
  providers: [IndexerService],
})
export class IndexerModule {}
