/**
 * Root BullMQ config. Imported into AppModule ONLY when `isRedisConfigured()`
 * (see the conditional spread in app.module.ts) so the app can boot Redis-free.
 */
import { BullModule } from '@nestjs/bullmq'
import { getRedisConnection } from '@app/shared/redis/redis.util'

/** Returns the `BullModule.forRootAsync` dynamic module bound to `REDIS_URL`. */
export const bullmqConfig = () =>
  BullModule.forRootAsync({
    useFactory: () => ({ connection: getRedisConnection() }),
  })
