import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { IJwtPayload } from '@app/shared/interfaces'
import { RoomService } from './room.service'
import { MessageService } from './message.service'

/** Per-socket send rate limit: max 5 messages per rolling second. */
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 1000

interface AckResponse<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

@WebSocketGateway({ namespace: '/chat', cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(ChatGateway.name)
  private readonly rate = new Map<string, { count: number; ts: number }>()

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly roomService: RoomService,
    private readonly messageService: MessageService,
  ) {}

  // ---- Connection lifecycle ----------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client)
      if (!token) throw new Error('Missing token')
      const payload = await this.jwt.verifyAsync<IJwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      })
      client.data.userId = payload.sub
      this.logger.debug(`Socket ${client.id} authenticated as user ${payload.sub}`)
    } catch {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid or missing token' })
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket): void {
    this.rate.delete(client.id)
  }

  // ---- Client → Server events --------------------------------------------

  @SubscribeMessage('room:join')
  async onRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<AckResponse<{ roomId: string }>> {
    try {
      const userId = client.data.userId as string
      await this.roomService.assertAccess(userId, body.roomId)
      await client.join(body.roomId)
      client.emit('room:joined', { roomId: body.roomId })
      return { ok: true, data: { roomId: body.roomId } }
    } catch (err) {
      return this.fail(client, 'FORBIDDEN', (err as Error).message)
    }
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<AckResponse<{ roomId: string }>> {
    await client.leave(body.roomId)
    return { ok: true, data: { roomId: body.roomId } }
  }

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; body: string; type?: 'text' | 'image' | 'gif' },
  ): Promise<AckResponse> {
    const userId = client.data.userId as string

    if (!this.allow(client.id)) {
      return this.fail(client, 'RATE_LIMITED', 'Too many messages, slow down')
    }

    try {
      await this.roomService.assertAccess(userId, body.roomId)
      const message = await this.messageService.send(
        body.roomId,
        userId,
        body.body,
        body.type ?? 'text',
      )
      this.server.to(body.roomId).emit('message:new', message)
      return { ok: true, data: message }
    } catch (err) {
      return this.fail(client, 'SEND_FAILED', (err as Error).message)
    }
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; isTyping: boolean },
  ): void {
    const userId = client.data.userId as string
    client.to(body.roomId).emit('typing', { roomId: body.roomId, userId, isTyping: body.isTyping })
  }

  // ---- web3 seam ----------------------------------------------------------

  /**
   * Force a user out of a room and notify their sockets. Wired from day 1 so the
   * web3 upgrade path is already exposed: web2 = manual kick; web3 = a
   * Web3GatedMembershipService calls this when a holder sells their key.
   */
  async revokeAccess(userId: string, roomId: string): Promise<void> {
    const sockets = await this.server.fetchSockets()
    for (const s of sockets) {
      if (s.data.userId === userId) {
        s.leave(roomId)
        s.emit('access:revoked', { roomId })
      }
    }
  }

  // ---- helpers ------------------------------------------------------------

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined
    if (authToken) return authToken.replace(/^Bearer\s+/i, '')
    const header = client.handshake.headers?.authorization
    if (header) return header.replace(/^Bearer\s+/i, '')
    return undefined
  }

  private allow(socketId: string): boolean {
    const now = Date.now()
    const entry = this.rate.get(socketId)
    if (!entry || now - entry.ts >= RATE_WINDOW_MS) {
      this.rate.set(socketId, { count: 1, ts: now })
      return true
    }
    if (entry.count >= RATE_LIMIT) return false
    entry.count += 1
    return true
  }

  private fail<T>(client: Socket, code: string, message: string): AckResponse<T> {
    client.emit('error', { code, message })
    return { ok: false, error: message }
  }
}
