import { Column, Entity, Index, Unique } from 'typeorm'
import { MyEntity } from '@app/shared/base'

export enum RoomMemberRole {
  MEMBER = 'member',
  MODERATOR = 'moderator',
  PRESIDENT = 'president',
}

/** Join row: which users belong to which room. Membership is decoupled from gating. */
@Entity('room_members')
@Unique(['roomId', 'userId'])
export class RoomMember extends MyEntity {
  @Index()
  @Column('uuid')
  roomId: string

  @Index()
  @Column('uuid')
  userId: string

  @Column({ type: 'enum', enum: RoomMemberRole, default: RoomMemberRole.MEMBER })
  role: RoomMemberRole
}
