import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Post } from './entities/post.entity'
import { PostLike } from './entities/post-like.entity'
import { Trade } from './entities/trade.entity'
import { PostsController } from './posts.controller'
import { PostsService } from './posts.service'
import { CronScheduler } from './scheduler/cron-scheduler.service'
import { POST_SCHEDULER } from './scheduler/scheduler.service'

// ScheduleModule.forRoot() is registered globally in AppModule, so @Cron in
// CronScheduler is picked up without importing ScheduleModule here.
@Module({
  imports: [TypeOrmModule.forFeature([Post, PostLike, Trade, User, Club])],
  controllers: [PostsController],
  providers: [
    PostsService,
    CronScheduler,
    // Swap useClass to a future QueueScheduler (BullMQ) to enable exact-timing
    // firing; the interface and PostsService call sites stay unchanged.
    { provide: POST_SCHEDULER, useClass: CronScheduler },
  ],
  exports: [PostsService],
})
export class PostsModule {}
