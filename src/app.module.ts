import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { CacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import { rootConfig, dbConfig, jwtConfig, corsConfig, swaggerConfig } from '@app/config'
import { bullmqConfig } from '@app/config/bullmq.config'
import { isRedisConfigured } from '@app/shared/redis/redis.util'
import { TaskSchedulerModule } from './task-scheduler/task-scheduler.module'
import { HealthModule } from './health/health.module'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { ChatModule } from './chat/chat.module'
import { ClubsModule } from './clubs/clubs.module'
import { SocialModule } from './social/social.module'
import { WalletModule } from './wallet/wallet.module'
import { LpModule } from './lp/lp.module'
import { PostsModule } from './posts/posts.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [rootConfig, dbConfig, jwtConfig, corsConfig, swaggerConfig],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.username'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.database'),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('db.synchronize'),
        // Migrations glob so main.ts can auto-apply them on boot (TYPEORM_MIGRATIONS_RUN=true).
        migrations: [__dirname + '/migrations/*{.js,.ts}'],
        migrationsTableName: 'migrations',
        logging: config.get<boolean>('db.logging'),
        ssl: config.get<boolean>('db.ssl') ? { rejectUnauthorized: false } : false,
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),

    // Durable BullMQ jobs — wired only when REDIS_URL is set. Without Redis the
    // app boots on the Redis-free CronScheduler fallback (see posts.module.ts).
    ...(isRedisConfigured() ? [bullmqConfig(), TaskSchedulerModule] : []),

    // Feature modules — add new ones here.
    HealthModule,
    UsersModule,
    AuthModule,
    ChatModule,
    ClubsModule,
    SocialModule,
    WalletModule,
    LpModule,
    PostsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
