import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { NotificationsModule } from '@app/src/notifications/notifications.module'
import { PostsModule } from '@app/src/posts/posts.module'
import { Follow } from './entities/follow.entity'
import { SocialController } from './social.controller'
import { SocialService } from './social.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, User, Holding, Club]),
    NotificationsModule,
    PostsModule,
  ],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
