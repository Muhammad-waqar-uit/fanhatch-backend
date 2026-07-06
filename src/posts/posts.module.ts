import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { isRedisConfigured } from '@app/shared/redis/redis.util'
import { POST_PUBLISH_QUEUE } from '@app/shared/constant/queues'
import { TaskSchedulerModule } from '@app/src/task-scheduler/task-scheduler.module'
import { NotificationsModule } from '@app/src/notifications/notifications.module'
import { Post } from './entities/post.entity'
import { PostLike } from './entities/post-like.entity'
import { Trade } from './entities/trade.entity'
import { PostsController } from './posts.controller'
import { PostsService } from './posts.service'
import { CronScheduler } from './scheduler/cron-scheduler.service'
import { QueueScheduler } from './scheduler/queue-scheduler.service'
import { PostPublishProcessor } from './processors/post-publish.processor'
import { POST_SCHEDULER } from './scheduler/scheduler.service'

// Redis present → precise BullMQ firing via QueueScheduler (+ processor on
// worker processes). Redis absent → the Redis-free CronScheduler sweep. Either
// way the POST_SCHEDULER seam keeps PostsService unchanged.
const redis = isRedisConfigured()
const runWorkers = process.env.RUN_WORKERS !== 'false'

// ScheduleModule.forRoot() is registered globally in AppModule, so @Cron in
// CronScheduler is picked up without importing ScheduleModule here.
@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostLike, Trade, User, Club, Holding]),
    NotificationsModule,
    ...(redis ? [BullModule.registerQueue({ name: POST_PUBLISH_QUEUE }), TaskSchedulerModule] : []),
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    // Bind the active scheduler behind the POST_SCHEDULER token.
    redis
      ? { provide: POST_SCHEDULER, useClass: QueueScheduler }
      : { provide: POST_SCHEDULER, useClass: CronScheduler },
    // Register the processor only on worker-enabled processes with Redis.
    ...(redis && runWorkers ? [PostPublishProcessor] : []),
  ],
  exports: [PostsService],
})
export class PostsModule {}
