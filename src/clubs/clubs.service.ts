import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PaginateRO } from '@app/shared/dto'
import { User } from '@app/src/users/user.entity'
import { RoomService } from '@app/src/chat/room.service'
import { Club, ClubCurveType } from './entities/club.entity'
import { Holding } from './entities/holding.entity'
import { Vote } from './entities/vote.entity'
import { estimatePrice, CurveType } from './curve.util'
import {
  BuyKeysResultDto,
  ClubDto,
  CreateClubDto,
  GiftKeyResultDto,
  PresidentDto,
  PriceEstimateDto,
  QueryClubsDto,
  VoteResultDto,
} from './dto'

/** Number formatting for the web2 curve — 8dp, matches the `numeric(20,8)` column. */
const money = (n: number): string => n.toFixed(8)

@Injectable()
export class ClubsService {
  constructor(
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
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

  /**
   * Web2 gift simulation: transfer `amount` keys from one holder to another.
   * Mirrors the on-chain `ClubKey.gift` (a transfer, not a mint — supply is
   * unchanged). Runs inside a DB transaction so the debit/credit stay atomic.
   */
  async giftKey(
    fromUserId: string,
    clubId: string,
    toUserId: string,
    amount = 1,
  ): Promise<GiftKeyResultDto> {
    if (toUserId === fromUserId) throw new BadRequestException('Cannot gift to yourself')
    if (amount < 1) throw new BadRequestException('Amount must be at least 1')

    const club = await this.findClub(clubId)

    const recipient = await this.users.findOne({ where: { id: toUserId } })
    if (!recipient) throw new NotFoundException('Recipient not found')

    return this.holdings.manager.transaction(async (manager) => {
      const clubRepo = manager.getRepository(Club)
      const holdingRepo = manager.getRepository(Holding)

      const sender = await holdingRepo.findOne({ where: { userId: fromUserId, clubId: club.id } })
      if (!sender || sender.keyCount < amount) {
        throw new BadRequestException('Insufficient keys')
      }

      // Debit the sender (keep the row even if it hits zero).
      sender.keyCount -= amount
      await holdingRepo.save(sender)

      // Credit the recipient, creating the holding + bumping memberCount if new.
      let recipientHolding = await holdingRepo.findOne({
        where: { userId: toUserId, clubId: club.id },
      })
      if (recipientHolding) {
        recipientHolding.keyCount += amount
      } else {
        recipientHolding = holdingRepo.create({ userId: toUserId, clubId: club.id, keyCount: amount })
        club.memberCount += 1
        await clubRepo.save(club)
      }
      await holdingRepo.save(recipientHolding)

      return {
        from: { keyCount: sender.keyCount },
        to: { userId: toUserId, keyCount: recipientHolding.keyCount },
        club: { id: club.id, memberCount: club.memberCount },
      }
    })
  }

  /**
   * Web2 governance sim (mirrors the on-chain GovernanceModule):
   * vote weight = keys the voter currently holds, and a candidate is elected
   * president once their total weight passes a simple majority of `supply`.
   * One vote per (club, voter) — re-voting overwrites the prior row.
   */
  async voteForPresident(
    voterId: string,
    clubId: string,
    candidateId: string,
  ): Promise<VoteResultDto> {
    const club = await this.findClub(clubId)

    const candidate = await this.users.findOne({ where: { id: candidateId } })
    if (!candidate) throw new NotFoundException('Candidate not found')

    const holding = await this.holdings.findOne({ where: { userId: voterId, clubId: club.id } })
    if (!holding || holding.keyCount < 1) {
      throw new BadRequestException('Must hold a key to vote')
    }

    // Upsert the voter's ballot (unique per club+voter). Weight = current keys.
    let vote = await this.votes.findOne({ where: { clubId: club.id, voterId } })
    if (vote) {
      vote.candidateId = candidateId
      vote.weight = holding.keyCount
    } else {
      vote = this.votes.create({
        clubId: club.id,
        voterId,
        candidateId,
        weight: holding.keyCount,
      })
    }
    await this.votes.save(vote)

    // Tally the candidate's total vote weight across the club.
    const tally = await this.tallyFor(club.id, candidateId)

    // Simple majority of supply elects (tally * 2 > supply).
    let elected = false
    if (tally * 2 > club.supply) {
      club.presidentId = candidateId
      await this.clubs.save(club)
      elected = true
    }

    return { candidateId, votes: tally, elected, presidentId: club.presidentId ?? null }
  }

  /** Current president + standings (votes grouped by candidate, weight summed). */
  async getPresident(clubId: string): Promise<PresidentDto> {
    const club = await this.findClub(clubId)

    const rows = await this.votes
      .createQueryBuilder('v')
      .select('v.candidateId', 'candidateId')
      .addSelect('SUM(v.weight)', 'votes')
      .where('v.clubId = :clubId', { clubId: club.id })
      .groupBy('v.candidateId')
      .orderBy('SUM(v.weight)', 'DESC')
      .getRawMany<{ candidateId: string; votes: string }>()

    const standings = await Promise.all(
      rows.map(async (r) => ({
        candidate: await this.candidateDto(r.candidateId),
        votes: parseInt(r.votes, 10),
      })),
    )

    const president = club.presidentId ? await this.candidateDto(club.presidentId) : null

    return {
      presidentId: club.presidentId ?? null,
      president,
      supply: club.supply,
      standings,
    }
  }

  // ---- internals ---------------------------------------------------------

  /** Sum of vote weight for a candidate within a club. */
  private async tallyFor(clubId: string, candidateId: string): Promise<number> {
    const row = await this.votes
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.weight), 0)', 'sum')
      .where('v.clubId = :clubId AND v.candidateId = :candidateId', { clubId, candidateId })
      .getRawOne<{ sum: string }>()
    return row?.sum ? parseInt(row.sum, 10) : 0
  }

  /** {id, handle, name} for a user id (handle/name fall back to the username). */
  private async candidateDto(userId: string): Promise<{ id: string; handle: string; name: string }> {
    const user = await this.users.findOne({ where: { id: userId } })
    return {
      id: userId,
      handle: user?.username ?? 'unknown',
      name: user?.username ?? 'Unknown',
    }
  }

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
