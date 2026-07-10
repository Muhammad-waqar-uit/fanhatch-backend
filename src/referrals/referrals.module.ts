import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { ReferralsController } from './referrals.controller'
import { ReferralsService } from './referrals.service'

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
