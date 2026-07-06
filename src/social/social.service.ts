import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, LessThanOrEqual, Repository } from 'typeorm'
import { PaginateRO } from '@app/shared/dto'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { NotificationsService } from '@app/src/notifications/notifications.service'
import { NotificationRelatedTo, NotificationType } from '@app/src/notifications/enums'
import { Follow } from './entities/follow.entity'
import {
  ActivityDto,
  ClubCardDto,
  ProfileDto,
  UpdateProfileDto,
  UserCardDto,
  ViewerRelation,
} from './dto'

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name)

  constructor(
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Follows -----------------------------------------------------------

  /** Follow another user (409 on self-follow; idempotent on the pair). */
  async follow(followerId: string, followeeId: string): Promise<{ following: true }> {
    if (followerId === followeeId) throw new ConflictException('Cannot follow yourself')
    await this.assertUser(followeeId)
    const existing = await this.follows.findOne({ where: { followerId, followeeId } })
    if (!existing) {
      await this.follows.save(this.follows.create({ followerId, followeeId }))

      // Best-effort notification (never breaks the follow itself).
      try {
        const actor = await this.users.findOne({ where: { id: followerId } })
        const actorName = actor?.username ?? 'Someone'
        await this.notifications.create({
          userId: followeeId,
          type: NotificationType.FOLLOWED,
          relatedTo: NotificationRelatedTo.USER,
          title: `${actorName} followed you`,
          data: { actorId: followerId, actorName, actorAvatarUrl: actor?.avatarUrl },
        })
      } catch (err) {
        this.logger.warn(`FOLLOWED notification failed: ${(err as Error).message}`)
      }
    }
    return { following: true }
  }

  async unfollow(followerId: string, followeeId: string): Promise<{ following: false }> {
    await this.follows.delete({ followerId, followeeId })
    return { following: false }
  }

  /** Users following `userId`. */
  async followers(userId: string, page = 1, limit = 20): Promise<PaginateRO<UserCardDto>> {
    const [rows, total] = await this.follows.findAndCount({
      where: { followeeId: userId },
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return this.usersPage(rows.map((f) => f.followerId), total, page, limit)
  }

  /** Users `userId` follows. */
  async following(userId: string, page = 1, limit = 20): Promise<PaginateRO<UserCardDto>> {
    const [rows, total] = await this.follows.findAndCount({
      where: { followerId: userId },
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return this.usersPage(rows.map((f) => f.followeeId), total, page, limit)
  }

  // ---- Clubs / holdings --------------------------------------------------

  /** Clubs the user created. */
  async clubsCreated(userId: string): Promise<ClubCardDto[]> {
    const clubs = await this.clubs.find({
      where: { creatorId: userId },
      order: { created: 'DESC' },
    })
    return clubs.map((c) => this.clubCard(c))
  }

  /** Clubs the user holds keys in. */
  async holding(userId: string): Promise<ClubCardDto[]> {
    const rows = await this.holdings.find({ where: { userId } })
    const clubIds = rows.map((h) => h.clubId)
    if (!clubIds.length) return []
    const clubs = await this.clubs.find({ where: { id: In(clubIds) } })
    return clubs.map((c) => this.clubCard(c))
  }

  /** Users who hold keys in any club created by this user. */
  async holders(userId: string): Promise<UserCardDto[]> {
    const clubs = await this.clubs.find({ where: { creatorId: userId } })
    const clubIds = clubs.map((c) => c.id)
    if (!clubIds.length) return []
    const rows = await this.holdings.find({ where: { clubId: In(clubIds) } })
    const holderIds = [...new Set(rows.map((h) => h.userId))]
    if (!holderIds.length) return []
    const users = await this.users.findBy({ id: In(holderIds) })
    return users.map((u) => this.userCard(u))
  }

  // ---- Activity (stub — trades/posts come later) -------------------------

  async activity(_userId: string, page = 1, limit = 20): Promise<PaginateRO<ActivityDto>> {
    return { items: [], meta: { total: 0, page, limit, totalPages: 0 } }
  }

  // ---- Profile -----------------------------------------------------------

  async profileByHandle(handle: string, viewerId?: string): Promise<ProfileDto> {
    const user = await this.users.findOne({ where: { username: handle } })
    if (!user) throw new NotFoundException('User not found')
    return this.buildProfile(user, viewerId)
  }

  async profileById(id: string, viewerId?: string): Promise<ProfileDto> {
    const user = await this.users.findOne({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return this.buildProfile(user, viewerId)
  }

  /** Update the viewer's own profile fields (bio/avatar persist; displayName/socials are web2 stubs). */
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (dto.bio !== undefined) user.bio = dto.bio
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl
    await this.users.save(user)
    return this.buildProfile(user, userId)
  }

  // ---- internals ---------------------------------------------------------

  private async assertUser(id: string): Promise<void> {
    const exists = await this.users.findOne({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundException('User not found')
  }

  private async buildProfile(user: User, viewerId?: string): Promise<ProfileDto> {
    const clubs = await this.clubs.find({ where: { creatorId: user.id } })
    const clubIds = clubs.map((c) => c.id)

    const [holdersCount, holdingCount, followers, following, userNumber, relation] =
      await Promise.all([
        clubIds.length
          ? this.holdings
              .createQueryBuilder('h')
              .select('COUNT(DISTINCT h.userId)', 'c')
              .where('h.clubId IN (:...clubIds)', { clubIds })
              .getRawOne<{ c: string }>()
              .then((r) => parseInt(r?.c ?? '0', 10))
          : Promise.resolve(0),
        this.holdings.count({ where: { userId: user.id } }),
        this.follows.count({ where: { followeeId: user.id } }),
        this.follows.count({ where: { followerId: user.id } }),
        this.users.count({ where: { created: LessThanOrEqual(user.created) } }),
        this.viewerRelation(user.id, viewerId),
      ])

    const primaryClub = clubs[0]
    let ownKeyCount: number | undefined
    if (primaryClub) {
      const own = await this.holdings.findOne({
        where: { userId: user.id, clubId: primaryClub.id },
      })
      ownKeyCount = own?.keyCount
    }

    return {
      id: user.id,
      handle: user.username,
      displayName: user.username,
      userNumber,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      walletAddress: user.walletAddress,
      socials: undefined,
      stats: { holders: holdersCount, holding: holdingCount, followers, following },
      keyPrice: primaryClub?.keyPrice,
      ownKeyCount,
      viewerRelation: relation,
      lastSeen: user.updated?.toISOString(),
    }
  }

  private async viewerRelation(userId: string, viewerId?: string): Promise<ViewerRelation> {
    if (!viewerId) return 'anonymous'
    if (viewerId === userId) return 'self'
    const edge = await this.follows.findOne({
      where: { followerId: viewerId, followeeId: userId },
    })
    return edge ? 'following' : 'other'
  }

  private async usersPage(
    ids: string[],
    total: number,
    page: number,
    limit: number,
  ): Promise<PaginateRO<UserCardDto>> {
    const users = ids.length ? await this.users.findBy({ id: In(ids) }) : []
    const byId = new Map(users.map((u) => [u.id, u]))
    const items = ids.map((id) => byId.get(id)).filter(Boolean).map((u) => this.userCard(u!))
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  private userCard(u: User): UserCardDto {
    return { id: u.id, handle: u.username, displayName: u.username, avatarUrl: u.avatarUrl }
  }

  private clubCard(c: Club): ClubCardDto {
    return {
      id: c.id,
      ftId: c.ftId,
      name: c.name,
      ticker: c.ticker,
      avatarUrl: c.avatarUrl,
      keyPrice: c.keyPrice,
      description: c.description,
    }
  }
}
