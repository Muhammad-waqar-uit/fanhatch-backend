import { Global, Module } from '@nestjs/common'
import { BlockchainService } from './blockchain.service'

/** Global so the indexer / gating swap can inject the provider anywhere. */
@Global()
@Module({ providers: [BlockchainService], exports: [BlockchainService] })
export class BlockchainModule {}
