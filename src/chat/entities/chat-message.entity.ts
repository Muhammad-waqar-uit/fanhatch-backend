import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

export enum ChatMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  GIF = 'gif',
}

/** Persisted message (source of truth). History is cursor-paginated by `created`. */
@Entity('chat_messages')
@Index(['roomId', 'created'])
export class ChatMessage extends MyEntity {
  @Column('uuid')
  roomId: string

  @Column('uuid')
  senderId: string

  @Column({ type: 'enum', enum: ChatMessageType, default: ChatMessageType.TEXT })
  type: ChatMessageType

  @Column({ type: 'text' })
  body: string
}
