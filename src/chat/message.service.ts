import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { ChatMessage, ChatMessageType } from './entities/chat-message.entity'
import { ChatMessageDto, LastMessageDto, MessageHistoryDto, MessageType } from './dto'

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Persist a message and return its DTO (sender name/avatar joined from users). */
  async send(
    roomId: string,
    senderId: string,
    body: string,
    type: MessageType = 'text',
  ): Promise<ChatMessageDto> {
    const saved = await this.messages.save(
      this.messages.create({ roomId, senderId, body, type: type as ChatMessageType }),
    )
    const sender = await this.users.findOne({ where: { id: senderId } })
    return this.toDto(saved, sender)
  }

  /**
   * Cursor-paginated history, newest → older. `cursor` is the ISO `created` of the
   * last item from the previous page; `nextCursor` is null when there is no more.
   */
  async history(roomId: string, cursor?: string, limit = 30): Promise<MessageHistoryDto> {
    const qb = this.messages
      .createQueryBuilder('m')
      .where('m.roomId = :roomId', { roomId })
      .orderBy('m.created', 'DESC')
      .take(limit + 1)
    if (cursor) qb.andWhere('m.created < :cursor', { cursor: new Date(cursor) })

    const rows = await qb.getMany()
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    const senderIds = [...new Set(page.map((m) => m.senderId))]
    const senders = senderIds.length ? await this.users.findBy({ id: In(senderIds) }) : []
    const byId = new Map(senders.map((u) => [u.id, u]))

    return {
      items: page.map((m) => this.toDto(m, byId.get(m.senderId))),
      nextCursor: hasMore ? page[page.length - 1].created.toISOString() : null,
    }
  }

  /** Lightweight last-message summary for room list previews. */
  async lastMessage(roomId: string): Promise<LastMessageDto | undefined> {
    const m = await this.messages.findOne({ where: { roomId }, order: { created: 'DESC' } })
    return m ? { body: m.body, sentAt: m.created.toISOString() } : undefined
  }

  private toDto(m: ChatMessage, sender?: User): ChatMessageDto {
    return {
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      senderName: sender?.username ?? 'Unknown',
      senderAvatarUrl: sender?.avatarUrl,
      type: m.type,
      body: m.body,
      sentAt: m.created.toISOString(),
    }
  }
}
