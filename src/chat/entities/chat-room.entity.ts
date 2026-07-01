import { Column, Entity } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** Kind of chat room. `club` rooms carry a `clubId` (future web3 gating key). */
export enum ChatRoomType {
  CLUB = 'club',
  DM = 'dm',
  GROUP = 'group',
}

@Entity('chat_rooms')
export class ChatRoom extends MyEntity {
  @Column({ type: 'enum', enum: ChatRoomType })
  type: ChatRoomType

  @Column()
  name: string

  @Column({ nullable: true })
  avatarUrl?: string

  /** Set for club rooms — the gating key a future Web3MembershipService checks holdings against. */
  @Column({ type: 'uuid', nullable: true })
  clubId?: string

  @Column('uuid')
  createdById: string
}
