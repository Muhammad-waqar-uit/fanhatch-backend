import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { IJwtPayload } from '@app/shared/interfaces'

/**
 * Real-time notifications gateway (namespace `/notifications`).
 *
 * Mirrors {@link ChatGateway}'s JWT handshake: the token is read from
 * `handshake.auth.token` (or the Authorization header), verified, and the
 * socket is joined to a per-user room `user:<id>`. Server → client pushes
 * (`notification:new`, `notification:count`) are addressed to that room.
 *
 * In a single-process dev setup the service emits straight through this gateway
 * via {@link emitToUser}. When Redis is configured, `NotificationEmitter` emits
 * through the Redis emitter instead so the API *and* worker processes deliver
 * uniformly (the API's `@socket.io/redis-adapter` fans out to the right node).
 */
@WebSocketGateway({ namespace: '/notifications', cors: true })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(NotificationsGateway.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client)
      if (!token) throw new Error('Missing token')
      const payload = await this.jwt.verifyAsync<IJwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      })
      client.data.userId = payload.sub
      await client.join(`user:${payload.sub}`)
      this.logger.debug(`Socket ${client.id} joined notifications room for user ${payload.sub}`)
    } catch {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid or missing token' })
      client.disconnect(true)
    }
  }

  /** Push an event to every socket the user has open (in-process path). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload)
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined
    if (authToken) return authToken.replace(/^Bearer\s+/i, '')
    const header = client.handshake.headers?.authorization
    if (header) return header.replace(/^Bearer\s+/i, '')
    return undefined
  }
}
