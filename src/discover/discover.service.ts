import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Follow } from '@app/src/social/entities/follow.entity'
import { PostsService } from '@app/src/posts/posts.service'
import {
  DiscoverCreatorDto,
  DiscoverSearchResultDto,
  DiscoverTrendingClubDto,
} from './dto'

/** Raw row shape for the creator aggregate query. */
interface CreatorRow {
  id: string
  username: string
  avatarUrl: string | null
  bio: string | null
  followers: string
}

@Injectable()
export class DiscoverService {
  constructor(
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    private readonly posts: PostsService,
  ) {}

  /**
   * Trending clubs ranked by memberCount desc (tiebreak supply desc). `keyPrice`
   * is the stored web2 curve price (same value ClubsService.toDto returns).
   */
  async trendingClubs(limit = 12): Promise<DiscoverTrendingClubDto[]> {
    const clubs = await this.clubs
      .createQueryBuilder('c')
      .orderBy('c.memberCount', 'DESC')
      .addOrderBy('c.supply', 'DESC')
      .take(limit)
      .getMany()

    return clubs.map((c) => this.toTrendingClub(c))
  }

  /**
   * Suggested creators ranked by follower count desc (tiebreak: oldest account
   * first). When a viewer is authenticated, the viewer and everyone they already
   * follow are excluded.
   */
  async creators(limit = 10, viewerId?: string): Promise<DiscoverCreatorDto[]> {
    const qb = this.users
      .createQueryBuilder('u')
      .leftJoin(Follow, 'f', 'f.followeeId = u.id')
      .select('u.id', 'id')
      .addSelect('u.username', 'username')
      .addSelect('u.avatarUrl', 'avatarUrl')
      .addSelect('u.bio', 'bio')
      .addSelect('COUNT(f.id)', 'followers')
      .groupBy('u.id')
      .orderBy('COUNT(f.id)', 'DESC')
      .addOrderBy('u.created', 'ASC')
      .limit(limit)

    if (viewerId) {
      qb.where('u.id != :viewerId', { viewerId }).andWhere(
        'u.id NOT IN (SELECT fw.followeeId FROM follows fw WHERE fw.followerId = :viewerId)',
        { viewerId },
      )
    }

    const rows = await qb.getRawMany<CreatorRow>()
    return rows.map((r) => this.toCreator(r))
  }

  /**
   * Universal search across clubs (name/ticker), creators (username) and posts
   * (published, top-level body). Each bucket is capped at 10. Empty `q` short-
   * circuits to three empty arrays. All patterns are parameterized (ILIKE).
   */
  async search(q?: string, viewerId?: string): Promise<DiscoverSearchResultDto> {
    const term = (q ?? '').trim()
    if (!term) return { clubs: [], creators: [], posts: [] }

    const like = `%${term}%`
    const [clubs, creators, posts] = await Promise.all([
      this.searchClubs(like),
      this.searchCreators(like),
      this.posts.searchPosts(term, 10, viewerId),
    ])

    return { clubs, creators, posts }
  }

  // ---- internals ---------------------------------------------------------

  private async searchClubs(like: string): Promise<DiscoverTrendingClubDto[]> {
    const clubs = await this.clubs
      .createQueryBuilder('c')
      .where('c.name ILIKE :like OR c.ticker ILIKE :like', { like })
      .orderBy('c.memberCount', 'DESC')
      .addOrderBy('c.supply', 'DESC')
      .take(10)
      .getMany()

    return clubs.map((c) => this.toTrendingClub(c))
  }

  private async searchCreators(like: string): Promise<DiscoverCreatorDto[]> {
    const rows = await this.users
      .createQueryBuilder('u')
      .leftJoin(Follow, 'f', 'f.followeeId = u.id')
      .select('u.id', 'id')
      .addSelect('u.username', 'username')
      .addSelect('u.avatarUrl', 'avatarUrl')
      .addSelect('u.bio', 'bio')
      .addSelect('COUNT(f.id)', 'followers')
      .where('u.username ILIKE :like', { like })
      .groupBy('u.id')
      .orderBy('COUNT(f.id)', 'DESC')
      .addOrderBy('u.created', 'ASC')
      .limit(10)
      .getRawMany<CreatorRow>()

    return rows.map((r) => this.toCreator(r))
  }

  private toTrendingClub(c: Club): DiscoverTrendingClubDto {
    return {
      id: c.id,
      clubId: c.clubId,
      name: c.name,
      ticker: c.ticker,
      ftId: c.ftId,
      keyPrice: c.keyPrice,
      memberCount: c.memberCount,
      // ponytail: placeholder 0 — no historical price series exists yet, so a real
      // 24h delta can't be computed until a club price-history table lands.
      changePct: 0,
    }
  }

  private toCreator(r: CreatorRow): DiscoverCreatorDto {
    return {
      id: r.id,
      name: r.username,
      handle: r.username,
      avatarUrl: r.avatarUrl ?? undefined,
      bio: r.bio ?? undefined,
      followers: parseInt(r.followers, 10) || 0,
    }
  }
}
