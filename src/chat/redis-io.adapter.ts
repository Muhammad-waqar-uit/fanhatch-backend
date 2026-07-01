import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import { ServerOptions } from 'socket.io'

/**
 * Socket.io adapter backed by Redis pub/sub for horizontal scale.
 *
 * Enabled only when `REDIS_URL` is set (see main.ts). In dev the default
 * single-node in-memory adapter is used — flipping to multi-node is a
 * zero-code-change env toggle.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new Redis(url)
    const subClient = pubClient.duplicate()
    this.adapterConstructor = createAdapter(pubClient, subClient)
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options)
    server.adapter(this.adapterConstructor)
    return server
  }
}
