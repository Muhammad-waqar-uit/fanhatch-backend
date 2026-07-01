import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatRoom, ChatRoomType } from './entities/chat-room.entity'
import { RoomMember, RoomMemberRole } from './entities/room-member.entity'
import { ChatRoomDto, CreateRoomDto } from './dto'
import { MEMBERSHIP_SERVICE, MembershipService } from './membership/membership.service'
import { MessageService } from './message.service'

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(ChatRoom) private readonly rooms: Repository<ChatRoom>,
    @InjectRepository(RoomMember) private readonly members: Repository<RoomMember>,
    @Inject(MEMBERSHIP_SERVICE) private readonly membership: MembershipService,
    private readonly messageService: MessageService,
  ) {}

  /** Create a club/group room; the creator is auto-joined as 'president'. */
  async createRoom(creatorId: string, dto: CreateRoomDto): Promise<ChatRoomDto> {
    const room = await this.rooms.save(
      this.rooms.create({
        type: dto.type as unknown as ChatRoomType,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        clubId: dto.clubId,
        createdById: creatorId,
      }),
    )
    await this.members.save(
      this.members.create({ roomId: room.id, userId: creatorId, role: RoomMemberRole.PRESIDENT }),
    )
    return this.toDto(room)
  }

  /** Deterministic 1:1 DM: at most one room per unordered (user, peer) pair. */
  async getOrCreateDm(userId: string, peerUserId: string): Promise<ChatRoomDto> {
    if (userId === peerUserId) throw new ForbiddenException('Cannot open a DM with yourself')

    const existing = await this.rooms
      .createQueryBuilder('r')
      .innerJoin(RoomMember, 'm1', 'm1.roomId = r.id AND m1.userId = :userId', { userId })
      .innerJoin(RoomMember, 'm2', 'm2.roomId = r.id AND m2.userId = :peerUserId', { peerUserId })
      .where('r.type = :type', { type: ChatRoomType.DM })
      .getOne()
    if (existing) return this.toDto(existing)

    const room = await this.rooms.save(
      this.rooms.create({ type: ChatRoomType.DM, name: 'Direct Message', createdById: userId }),
    )
    await this.members.save([
      this.members.create({ roomId: room.id, userId, role: RoomMemberRole.MEMBER }),
      this.members.create({ roomId: room.id, userId: peerUserId, role: RoomMemberRole.MEMBER }),
    ])
    return this.toDto(room)
  }

  /** Rooms the user is a member of, optionally filtered by type. */
  async listMyRooms(userId: string, type?: ChatRoomType): Promise<ChatRoomDto[]> {
    const qb = this.rooms
      .createQueryBuilder('r')
      .innerJoin(RoomMember, 'm', 'm.roomId = r.id AND m.userId = :userId', { userId })
      .orderBy('r.updated', 'DESC')
    if (type) qb.andWhere('r.type = :type', { type })

    const rooms = await qb.getMany()
    return Promise.all(rooms.map((r) => this.toDto(r)))
  }

  async getRoom(roomId: string): Promise<ChatRoom> {
    const room = await this.rooms.findOne({ where: { id: roomId } })
    if (!room) throw new NotFoundException('Room not found')
    return room
  }

  async getRoomDto(roomId: string): Promise<ChatRoomDto> {
    return this.toDto(await this.getRoom(roomId))
  }

  /** Fetch the room and assert the user is allowed in — used by REST join + the gateway. */
  async assertAccess(userId: string, roomId: string): Promise<ChatRoom> {
    const room = await this.getRoom(roomId)
    if (!(await this.membership.canAccess(userId, room))) {
      throw new ForbiddenException('You do not have access to this room')
    }
    return room
  }

  /** Join: gate via MembershipService.canAccess (→ 403), then ensure the member row. */
  async join(userId: string, roomId: string): Promise<void> {
    const room = await this.assertAccess(userId, roomId)
    await this.membership.ensureMember(userId, room.id)
  }

  async leave(userId: string, roomId: string): Promise<void> {
    await this.members.delete({ roomId, userId })
  }

  memberCount(roomId: string): Promise<number> {
    return this.members.count({ where: { roomId } })
  }

  /** Serialize a room to the contract DTO (incl. memberCount + lastMessage). */
  async toDto(room: ChatRoom): Promise<ChatRoomDto> {
    const [memberCount, lastMessage] = await Promise.all([
      this.memberCount(room.id),
      this.messageService.lastMessage(room.id),
    ])
    return {
      id: room.id,
      type: room.type,
      name: room.name,
      avatarUrl: room.avatarUrl,
      clubId: room.clubId,
      memberCount,
      lastMessage,
    }
  }
}
