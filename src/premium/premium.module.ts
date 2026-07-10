import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { PremiumController } from './premium.controller'
import { PremiumService } from './premium.service'

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PremiumController],
  providers: [PremiumService],
})
export class PremiumModule {}
