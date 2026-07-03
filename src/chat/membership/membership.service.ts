import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatRoom, ChatRoomType } from '../entities/chat-room.entity'
import { RoomMember, RoomMemberRole } from '../entities/room-member.entity'
import { Holding } from '../../clubs/entities/holding.entity'

/**
 * DI token for the active membership/gating strategy.
 *
 * Membership (who is in a room) is decoupled from gating (who is *allowed* in).
 * Swap the binding in `chat.module.ts` to flip web2 → web3 with no gateway/REST
 * changes — see the WEB3 SEAM note below.
 */
export const MEMBERSHIP_SERVICE = 'MEMBERSHIP_SERVICE'

/** Minimum club keys a user must hold to enter that club's chat room. */
export const KEY_THRESHOLD = 1

/**
 * Thrown when a user is denied a club room for lack of a key. Carries a stable
 * `KEY_REQUIRED` code so the gateway ack and REST 403 can surface it uniformly.
 */
export class KeyRequiredException extends ForbiddenException {
  readonly code = 'KEY_REQUIRED'
  constructor() {
    super('Key required to join this club')
  }
}

export interface MembershipService {
  /** True if the user may read/post in the room right now. */
  canAccess(userId: string, room: ChatRoom): Promise<boolean>
  /** Idempotently make the user a member of the room. */
  ensureMember(userId: string, roomId: string): Promise<void>
}

/**
 * Web2 strategy: access is granted by an explicit `room_members` row, with
 * `group` rooms treated as open (link-shareable).
 *
 * ─── WEB3 SEAM ──────────────────────────────────────────────────────────────
 * A future `Web3GatedMembershipService` implements this same interface:
 *   canAccess = indexed holdings.key_count(userId, room.clubId) >= threshold
 *   ensureMember = auto-provision the row when the holder is verified
 * It also emits `access:revoked` when a holder sells out. Flipping the binding
 * in chat.module.ts is the ONLY change required.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class Web2MembershipService implements MembershipService {
  constructor(
    @InjectRepository(RoomMember) private readonly members: Repository<RoomMember>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
  ) {}

  async canAccess(userId: string, room: ChatRoom): Promise<boolean> {
    // Club rooms are key-gated: enter iff you hold >= KEY_THRESHOLD keys.
    // ─── WEB3 SEAM ────────────────────────────────────────────────────────
    // Web2 reads the `holdings` table below. A future Web3GatedMembershipService
    // reads on-chain-indexed holdings instead — same branch, same threshold,
    // just a different source of truth for key_count(userId, room.clubId).
    // ──────────────────────────────────────────────────────────────────────
    if (room.type === ChatRoomType.CLUB && room.clubId) {
      const holding = await this.holdings.findOne({
        where: { userId, clubId: room.clubId },
      })
      return !!holding && holding.keyCount >= KEY_THRESHOLD
    }

    // dm / group: unchanged web2 behavior — an explicit membership row grants
    // access; group rooms stay open (link-shareable).
    const existing = await this.members.findOne({ where: { roomId: room.id, userId } })
    if (existing) return true
    return room.type === ChatRoomType.GROUP
  }

  async ensureMember(userId: string, roomId: string): Promise<void> {
    const existing = await this.members.findOne({ where: { roomId, userId } })
    if (existing) return
    await this.members.save(
      this.members.create({ roomId, userId, role: RoomMemberRole.MEMBER }),
    )
  }
}
