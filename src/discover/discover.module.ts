import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Follow } from '@app/src/social/entities/follow.entity'
import { PostsModule } from '@app/src/posts/posts.module'
import { DiscoverController } from './discover.controller'
import { DiscoverService } from './discover.service'

@Module({
  imports: [TypeOrmModule.forFeature([Club, User, Follow]), PostsModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
  exports: [DiscoverService],
})
export class DiscoverModule {}
