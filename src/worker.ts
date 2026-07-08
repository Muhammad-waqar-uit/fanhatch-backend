// Run the worker in UTC so every `Date`, log timestamp, and DB write is
// timezone-consistent with the API process regardless of the host's locale.
process.env.TZ = 'UTC'

import 'dotenv/config'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/**
 * Dedicated worker process: runs the BullMQ processors + reconciler, no HTTP.
 *
 * Boots the same AppModule as an application *context* (no listener) so the
 * whole DI graph — TaskSchedulerModule, the post-publish processor, and the
 * reconciler cron — is wired exactly as in the API, minus the web server.
 * Run with `RUN_WORKERS=true` (the default). Requires `REDIS_URL`.
 */
const logger = new Logger('Worker')

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  })
  app.enableShutdownHooks()

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker...`)
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  logger.log('Fans.tech worker started — processing BullMQ jobs + reconciler cron')
}

bootstrap().catch((err) => {
  logger.error('Worker failed to start', err as Error)
  process.exit(1)
})
