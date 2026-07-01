import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { LpPool } from './entities/lp-pool.entity'
import { LpPosition } from './entities/lp-position.entity'
import { FarmPosition } from './entities/farm-position.entity'
import { LpController } from './lp.controller'
import { LpService } from './lp.service'

@Module({
  imports: [TypeOrmModule.forFeature([LpPool, LpPosition, FarmPosition, User])],
  controllers: [LpController],
  providers: [LpService],
  exports: [LpService],
})
export class LpModule {}
