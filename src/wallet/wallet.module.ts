import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { LpPool } from '@app/src/lp/entities/lp-pool.entity'
import { FarmPosition } from '@app/src/lp/entities/farm-position.entity'
import { WalletController } from './wallet.controller'
import { WalletService } from './wallet.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, Holding, Club, LpPool, FarmPosition])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
