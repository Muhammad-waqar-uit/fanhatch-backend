import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { isRedisConfigured } from '@app/shared/redis/redis.util'
import { NOTIFICATIONS_QUEUE } from '@app/shared/constant/queues'
import { Notification } from './entities/notification.entity'
import { NotificationSetting } from './entities/notification-setting.entity'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationEmitter } from './notifications.emitter'
import { NotificationsProcessor } from './notifications.processor'

// Redis present → durable BullMQ fan-out (queue registered here; the processor
// only on worker-enabled processes). Redis absent → notifyMany falls back to an
// in-process create loop, and the emitter pushes via the local gateway.
const redis = isRedisConfigured()
const runWorkers = process.env.RUN_WORKERS !== 'false'

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationSetting]),
    // JWT for the WebSocket handshake (mirrors ChatModule).
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') as never },
      }),
    }),
    ...(redis ? [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })] : []),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationEmitter,
    // Consume fan-out jobs only on a worker-enabled process with Redis.
    ...(redis && runWorkers ? [NotificationsProcessor] : []),
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
