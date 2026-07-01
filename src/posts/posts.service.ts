import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, LessThanOrEqual, Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Post, PostStatus } from './entities/post.entity'
import { PostLike } from './entities/post-like.entity'
import { Trade } from './entities/trade.entity'
import { POST_SCHEDULER, PostScheduler } from './scheduler/scheduler.service'
import {
  CreatePostDto,
  FeedFilter,
  FeedResponseDto,
  FeedUserDto,
  MinePostsResponseDto,
  PostDto,
  TradeActivityDto,
  TrendingItemDto,
  UpdatePostDto,
} from './dto'

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(PostLike) private readonly likes: Repository<PostLike>,
    @InjectRepository(Trade) private readonly trades: Repository<Trade>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @Inject(POST_SCHEDULER) private readonly scheduler: PostScheduler,
  ) {}

  /** Create a post authored by the JWT user. */
  async createPost(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const status = dto.status ?? PostStatus.PUBLISHED
    let scheduledAt: Date | null = dto.scheduledAt ? new Date(dto.scheduledAt) : null

    if (status === PostStatus.SCHEDULED) {
      scheduledAt = this.requireFuture(scheduledAt)
    }

    const post = await this.posts.save(
      this.posts.create({
        authorId,
        body: dto.body,
        status,
        scheduledAt,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        crossPostTargets: dto.crossPostTargets ?? null,
      }),
    )

    if (status === PostStatus.SCHEDULED && scheduledAt) {
      this.scheduler.onScheduled(post.id, scheduledAt)
    }

    const authors = await this.userMap([authorId])
    return this.toPostDto(post, 0, false, authors)
  }

  /** The caller's posts, optionally filtered by status, newest first. */
  async listMine(
    userId: string,
    status: PostStatus | undefined,
    page: number,
    limit: number,
  ): Promise<MinePostsResponseDto> {
    const [rows, total] = await this.posts.findAndCount({
      where: { authorId: userId, ...(status ? { status } : {}) },
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const authors = await this.userMap([userId])
    const items = rows.map((p) => this.toPostDto(p, 0, false, authors))
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    }
  }

  /**
   * Author-only edit. Allows changing `body`, `scheduledAt`, and status
   * transitions draft↔scheduled and →published. Moving to `scheduled` requires
   * a future `scheduledAt`.
   */
  async updatePost(userId: string, id: string, dto: UpdatePostDto): Promise<PostDto> {
    const post = await this.assertAuthor(id, userId)
    const prevStatus = post.status

    if (dto.body !== undefined) post.body = dto.body

    const target = dto.status ?? post.status
    const nextScheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : post.scheduledAt ?? null

    if (target === PostStatus.SCHEDULED) {
      const at = this.requireFuture(nextScheduledAt)
      post.status = PostStatus.SCHEDULED
      post.scheduledAt = at
      post.publishedAt = null
      // Re-arm firing whether we're arriving from draft or moving the time.
      this.scheduler.onRescheduled(post.id, at)
    } else if (target === PostStatus.PUBLISHED) {
      post.status = PostStatus.PUBLISHED
      post.publishedAt = post.publishedAt ?? new Date()
      if (prevStatus === PostStatus.SCHEDULED) this.scheduler.onCancelled(post.id)
    } else {
      // → draft (cancel a schedule) or a plain body edit on a draft.
      if (dto.scheduledAt !== undefined) post.scheduledAt = nextScheduledAt
      post.status = PostStatus.DRAFT
      if (prevStatus === PostStatus.SCHEDULED) this.scheduler.onCancelled(post.id)
    }

    const saved = await this.posts.save(post)
    const authors = await this.userMap([userId])
    return this.toPostDto(saved, 0, false, authors)
  }

  /** Author-only delete. */
  async deletePost(userId: string, id: string): Promise<{ deleted: true }> {
    const post = await this.assertAuthor(id, userId)
    if (post.status === PostStatus.SCHEDULED) this.scheduler.onCancelled(post.id)
    await this.posts.delete({ id })
    return { deleted: true }
  }

  /** Author-only force-publish (draft/scheduled → published now). */
  async publishPost(userId: string, id: string): Promise<PostDto> {
    const post = await this.assertAuthor(id, userId)
    const wasScheduled = post.status === PostStatus.SCHEDULED
    post.status = PostStatus.PUBLISHED
    post.publishedAt = new Date()
    const saved = await this.posts.save(post)
    if (wasScheduled) this.scheduler.onCancelled(post.id)
    const authors = await this.userMap([userId])
    return this.toPostDto(saved, 0, false, authors)
  }

  /**
   * Idempotent auto-publish of due scheduled posts. The conditional UPDATE
   * (status='scheduled' AND scheduledAt <= now) means concurrent sweeps or a
   * re-run never double-publish. Returns the number of posts published.
   *
   * TODO(P1): after publishing, enqueue cross-post + notification jobs for the
   * affected post ids (return the ids from the UPDATE ... RETURNING to do so).
   */
  async publishDuePosts(): Promise<number> {
    const result = await this.posts.update(
      { status: PostStatus.SCHEDULED, scheduledAt: LessThanOrEqual(new Date()) },
      { status: PostStatus.PUBLISHED, publishedAt: () => 'now()' },
    )
    return result.affected ?? 0
  }

  /**
   * Feed: `posts` → published posts only; `transactions` → trades only;
   * `all` → both. `viewerId` (optional) drives the `liked` flag.
   */
  async feed(
    filter: FeedFilter,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<FeedResponseDto> {
    const wantPosts = filter === FeedFilter.ALL || filter === FeedFilter.POSTS
    const wantTrades = filter === FeedFilter.ALL || filter === FeedFilter.TRANSACTIONS
    const skip = (page - 1) * limit

    const posts = wantPosts ? await this.loadPosts(skip, limit, viewerId) : []
    const trades = wantTrades ? await this.loadTrades(skip, limit) : []
    return { posts, trades }
  }

  /** Toggle a like on. Returns the new like state + total like count. */
  async like(postId: string, userId: string) {
    await this.assertPost(postId)
    const existing = await this.likes.findOne({ where: { postId, userId } })
    if (!existing) {
      await this.likes.save(this.likes.create({ postId, userId }))
    }
    return { liked: true, likes: await this.likes.count({ where: { postId } }) }
  }

  /** Toggle a like off. Returns the new like state + total like count. */
  async unlike(postId: string, userId: string) {
    await this.assertPost(postId)
    await this.likes.delete({ postId, userId })
    return { liked: false, likes: await this.likes.count({ where: { postId } }) }
  }

  /** Trending clubs ranked by memberCount then keyPrice → TrendingItem[]. */
  async trending(limit = 10): Promise<TrendingItemDto[]> {
    const clubs = await this.clubs
      .createQueryBuilder('c')
      .orderBy('c.memberCount', 'DESC')
      .addOrderBy('c.keyPrice', 'DESC')
      .take(limit)
      .getMany()

    return clubs.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.ftId,
      ticker: c.ticker,
      avatarUrl: c.avatarUrl,
      priceEth: Number(c.keyPrice),
      changePct: 0, // no historical price series yet
    }))
  }

  // ---- internals ---------------------------------------------------------

  private async loadPosts(
    skip: number,
    take: number,
    viewerId?: string,
  ): Promise<PostDto[]> {
    const rows = await this.posts.find({
      where: { status: PostStatus.PUBLISHED },
      order: { created: 'DESC' },
      skip,
      take,
    })
    if (!rows.length) return []

    const postIds = rows.map((p) => p.id)
    const authors = await this.userMap(rows.map((p) => p.authorId))

    // like counts per post
    const likeCounts = new Map<string, number>()
    const counts = await this.likes
      .createQueryBuilder('l')
      .select('l.postId', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('l.postId IN (:...postIds)', { postIds })
      .groupBy('l.postId')
      .getRawMany<{ postId: string; count: string }>()
    counts.forEach((r) => likeCounts.set(r.postId, parseInt(r.count, 10)))

    // which of these the viewer liked
    const likedSet = new Set<string>()
    if (viewerId) {
      const mine = await this.likes.find({ where: { postId: In(postIds), userId: viewerId } })
      mine.forEach((l) => likedSet.add(l.postId))
    }

    return rows.map((p) =>
      this.toPostDto(p, likeCounts.get(p.id) ?? 0, likedSet.has(p.id), authors),
    )
  }

  private async loadTrades(skip: number, take: number): Promise<TradeActivityDto[]> {
    const rows = await this.trades.find({ order: { created: 'DESC' }, skip, take })
    if (!rows.length) return []
    const actors = await this.userMap(rows.map((t) => t.actorId))
    return rows.map((t) => ({
      id: t.id,
      user: actors.get(t.actorId) ?? this.unknownUser(t.actorId),
      side: t.side,
      amount: t.amount,
      ticker: t.ticker,
      priceEth: Number(t.pricePerKey),
      createdAt: t.created.toISOString(),
    }))
  }

  private toPostDto(
    post: Post,
    likes: number,
    liked: boolean,
    authors: Map<string, FeedUserDto>,
  ): PostDto {
    return {
      id: post.id,
      author: authors.get(post.authorId) ?? this.unknownUser(post.authorId),
      body: post.body,
      createdAt: post.created.toISOString(),
      stats: { likes, comments: 0, reposts: 0, shares: 0, bookmarks: 0 },
      liked,
      bookmarked: false,
      reposted: false,
      // `club` inline price chart left undefined — posts aren't club-linked yet.
    }
  }

  private async userMap(ids: string[]): Promise<Map<string, FeedUserDto>> {
    const unique = [...new Set(ids)]
    if (!unique.length) return new Map()
    const rows = await this.users.find({ where: { id: In(unique) } })
    const map = new Map<string, FeedUserDto>()
    rows.forEach((u) => map.set(u.id, this.toFeedUser(u)))
    return map
  }

  private toFeedUser(u: User): FeedUserDto {
    return {
      id: u.id,
      name: u.username,
      handle: u.username,
      avatarUrl: u.avatarUrl,
      verified: undefined, // no `verified` flag on users yet
    }
  }

  private unknownUser(id: string): FeedUserDto {
    return { id, name: 'Unknown', handle: 'unknown', avatarUrl: undefined, verified: undefined }
  }

  private async assertPost(id: string): Promise<void> {
    const exists = await this.posts.findOne({ where: { id } })
    if (!exists) throw new NotFoundException('Post not found')
  }

  /** Loads a post and enforces caller authorship (404 missing, 403 not author). */
  private async assertAuthor(id: string, userId: string): Promise<Post> {
    const post = await this.posts.findOne({ where: { id } })
    if (!post) throw new NotFoundException('Post not found')
    if (post.authorId !== userId) throw new ForbiddenException('Not your post')
    return post
  }

  /** Ensures a scheduled time is present and in the future (400 otherwise). */
  private requireFuture(at: Date | null | undefined): Date {
    if (!at || Number.isNaN(at.getTime())) {
      throw new BadRequestException('scheduledAt is required for scheduled posts')
    }
    if (at.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future')
    }
    return at
  }
}
