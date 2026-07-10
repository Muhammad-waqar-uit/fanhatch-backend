// Run the whole process in UTC so every `Date`, log timestamp, and DB write is
// timezone-consistent regardless of the host's locale. Must precede any import
// that could read the clock at load time.
process.env.TZ = 'UTC'

import 'dotenv/config'
import { json } from 'body-parser'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { useContainer } from 'class-validator'
import { DataSource } from 'typeorm'
import setupSwagger from '@app/shared/swagger'
import { ICorsConfig } from '@app/shared/interfaces'
import { RawBodyMiddleware } from '@app/shared/middleware'
import { HttpExceptionFilter } from '@app/shared/filters'
import { TransformInterceptor } from '@app/shared/interceptors'
import { AppModule } from './app.module'
import { RedisIoAdapter } from './chat/redis-io.adapter'

const logger = new Logger('Bootstrap')

/** Apply pending migrations on boot when TYPEORM_MIGRATIONS_RUN=true. */
async function runPendingMigrations(app: import('@nestjs/common').INestApplication) {
  if (process.env.TYPEORM_MIGRATIONS_RUN !== 'true') return
  const dataSource = app.get(DataSource)
  const applied = await dataSource.runMigrations({ transaction: 'each' })
  logger.log(applied.length ? `Applied ${applied.length} migration(s)` : 'Schema up to date')
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Close DB/Redis/BullMQ connections cleanly on SIGTERM/SIGINT (triggers
  // NestJS onModuleDestroy / OnApplicationShutdown hooks) so deploys don't
  // drop in-flight work or leak connections.
  app.enableShutdownHooks()

  const config = app.get(ConfigService)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new TransformInterceptor())

  // Let class-validator resolve DI (for custom validators that inject services).
  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.use(helmet())
  app.use(compression())
  app.use(cookieParser())
  app.use(RawBodyMiddleware())
  app.use(json({ limit: '10mb' }))

  app.enableCors(config.get<ICorsConfig>('cors'))
  app.setGlobalPrefix(config.get<string>('app.prefix'))
  setupSwagger(app)

  // Socket.io: use the Redis adapter for horizontal scale when REDIS_URL is set,
  // otherwise fall back to the default single-node in-memory adapter (dev).
  if (process.env.REDIS_URL) {
    const redisIoAdapter = new RedisIoAdapter(app)
    await redisIoAdapter.connectToRedis(process.env.REDIS_URL)
    app.useWebSocketAdapter(redisIoAdapter)
    logger.log('Socket.io Redis adapter enabled')
  }

  await runPendingMigrations(app)

  const port = config.get<number>('app.port')
  await app.listen(port)
  logger.log(`Fanhatch API listening on http://localhost:${port}/${config.get('app.prefix')}`)
}

bootstrap()
