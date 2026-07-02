import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { ChatModule } from '@app/src/chat/chat.module'
import { Club } from './entities/club.entity'
import { Holding } from './entities/holding.entity'
import { Vote } from './entities/vote.entity'
import { ClubsController } from './clubs.controller'
import { ClubsService } from './clubs.service'

@Module({
  imports: [TypeOrmModule.forFeature([Club, Holding, Vote, User]), ChatModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
