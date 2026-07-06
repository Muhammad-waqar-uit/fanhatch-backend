import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Emitter } from '@socket.io/redis-emitter'
import { Redis } from 'ioredis'
import { getRedisConnection, isRedisConfigured } from '@app/shared/redis/redis.util'
import { NotificationsGateway } from './notifications.gateway'

/** Socket.io namespace the FE connects to; must match the gateway. */
const NAMESPACE = '/notifications'

/**
 * Pushes real-time events to a user's socket room, transparently choosing the
 * scalable path:
 *
 * - **Redis configured** → publish via `@socket.io/redis-emitter`, which speaks
 *   the same protocol as the API's `@socket.io/redis-adapter`. This works
 *   uniformly from the API process *and* the BullMQ worker process, so
 *   queue-processed fan-out notifications still deliver live.
 * - **Redis absent** (single-process dev) → emit straight through the local
 *   {@link NotificationsGateway}.
 *
 * Consumers call {@link emitToUser} without caring which path is active.
 */
@Injectable()
export class NotificationEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmitter.name)
  private readonly redis?: Redis
  private readonly emitter?: Emitter

  constructor(private readonly gateway: NotificationsGateway) {
    if (isRedisConfigured()) {
      this.redis = new Redis(getRedisConnection())
      this.emitter = new Emitter(this.redis)
      this.logger.log('Notifications real-time push via Redis emitter')
    } else {
      this.logger.log('Notifications real-time push via in-process gateway')
    }
  }

  /** Deliver `event` + `payload` to every socket the user has open. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    try {
      if (this.emitter) {
        this.emitter.of(NAMESPACE).to(`user:${userId}`).emit(event, payload)
      } else {
        this.gateway.emitToUser(userId, event, payload)
      }
    } catch (err) {
      // Real-time delivery is best-effort — a failed push must never break the
      // originating write (the row is already persisted and will be polled).
      this.logger.warn(`Failed to emit ${event} to user ${userId}: ${(err as Error).message}`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit()
  }
}
