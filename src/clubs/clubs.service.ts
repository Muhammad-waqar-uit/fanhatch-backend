import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PaginateRO } from '@app/shared/dto'
import { User } from '@app/src/users/user.entity'
import { RoomService } from '@app/src/chat/room.service'
import { Club, ClubCurveType } from './entities/club.entity'
import { Holding } from './entities/holding.entity'
import { estimatePrice, CurveType } from './curve.util'
import { BuyKeysResultDto, ClubDto, CreateClubDto, PriceEstimateDto, QueryClubsDto } from './dto'

/** Number formatting for the web2 curve — 8dp, matches the `numeric(20,8)` column. */
const money = (n: number): string => n.toFixed(8)

@Injectable()
export class ClubsService {
  constructor(
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly rooms: RoomService,
  ) {}

  /** Create a club: assign clubId/ftId, seed the creator's holding + chat room. */
  async createClub(creatorId: string, dto: CreateClubDto): Promise<ClubDto> {
    const clubId = await this.nextClubId()
    const supply = 1 // creator's free first key
    const keyPrice = estimatePrice(dto.curveType as CurveType, supply)

    const club = await this.clubs.save(
      this.clubs.create({
        clubId,
        ftId: `FT${clubId}`,
        name: dto.name,
        ticker: dto.ticker,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        curveType: dto.curveType,
        creatorId,
        socials: dto.socials,
        supply,
        keyPrice: money(keyPrice),
        memberCount: 1,
      }),
    )

    // Creator auto-holds key #1.
    await this.holdings.save(
      this.holdings.create({ userId: creatorId, clubId: club.id, keyCount: 1 }),
    )

    // Provision the club chat room (creator becomes 'president' inside RoomService).
    const room = await this.rooms.createRoom(creatorId, {
      type: 'club',
      name: club.name,
      avatarUrl: club.avatarUrl,
      clubId: club.id,
    })

    return this.toDto(club, room.id)
  }

  async getClub(id: string): Promise<ClubDto> {
    return this.toDto(await this.findClub(id))
  }

  async getByFtId(ftId: string): Promise<ClubDto> {
    const club = await this.clubs.findOne({ where: { ftId } })
    if (!club) throw new NotFoundException('Club not found')
    return this.toDto(club)
  }

  /** Paginated list with `?search=` (name/ticker) + `?sort=trending|new|price`. */
  async list(query: QueryClubsDto): Promise<PaginateRO<ClubDto>> {
    const { page = 1, limit = 20, search, sort } = query
    const qb = this.clubs.createQueryBuilder('c')

    if (search) {
      qb.where('c.name ILIKE :s OR c.ticker ILIKE :s', { s: `%${search}%` })
    }

    if (sort === 'price') qb.orderBy('c.keyPrice', 'DESC')
    else if (sort === 'new') qb.orderBy('c.created', 'DESC')
    else qb.orderBy('c.memberCount', 'DESC').addOrderBy('c.created', 'DESC') // trending (default)

    qb.skip((page - 1) * limit).take(limit)

    const [rows, total] = await qb.getManyAndCount()
    const items = await Promise.all(rows.map((c) => this.toDto(c)))
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  /** Web2 curve estimate — buy at `supply`, sell at `supply-1`. */
  async priceEstimate(id: string, supply?: number): Promise<PriceEstimateDto> {
    const club = await this.findClub(id)
    const n = supply ?? club.supply
    const curve = club.curveType as unknown as CurveType
    return {
      buyPrice: money(estimatePrice(curve, n)),
      sellPrice: money(estimatePrice(curve, Math.max(1, n - 1))),
      supply: n,
    }
  }

  /** Web2 buy simulation: bump supply, reprice, upsert the buyer's holding. */
  async buyKeys(id: string, userId: string, amount: number): Promise<BuyKeysResultDto> {
    const club = await this.findClub(id)
    club.supply += amount
    club.keyPrice = money(estimatePrice(club.curveType as unknown as CurveType, club.supply))
    await this.clubs.save(club)

    let holding = await this.holdings.findOne({ where: { userId, clubId: club.id } })
    if (holding) {
      holding.keyCount += amount
    } else {
      holding = this.holdings.create({ userId, clubId: club.id, keyCount: amount })
      club.memberCount += 1
      await this.clubs.save(club)
    }
    await this.holdings.save(holding)

    return { supply: club.supply, keyPrice: club.keyPrice, holding: holding.keyCount }
  }

  // ---- internals ---------------------------------------------------------

  private async findClub(id: string): Promise<Club> {
    const club = await this.clubs.findOne({ where: { id } })
    if (!club) throw new NotFoundException('Club not found')
    return club
  }

  /** Next sequential clubId (web2 counter; on-chain factory assigns it later). */
  private async nextClubId(): Promise<number> {
    const row = await this.clubs
      .createQueryBuilder('c')
      .select('MAX(c.clubId)', 'max')
      .getRawOne<{ max: string | null }>()
    return (row?.max ? parseInt(row.max, 10) : 0) + 1
  }

  private async toDto(club: Club, chatRoomId?: string): Promise<ClubDto> {
    const creator = await this.users.findOne({ where: { id: club.creatorId } })
    return {
      id: club.id,
      clubId: club.clubId,
      ftId: club.ftId,
      name: club.name,
      ticker: club.ticker,
      description: club.description,
      avatarUrl: club.avatarUrl,
      curveType: club.curveType,
      creator: {
        id: club.creatorId,
        handle: creator?.username ?? 'unknown',
        name: creator?.username ?? 'Unknown',
      },
      socials: club.socials,
      supply: club.supply,
      keyPrice: club.keyPrice,
      memberCount: club.memberCount,
      chatRoomId,
      created: club.created.toISOString(),
    }
  }
}
