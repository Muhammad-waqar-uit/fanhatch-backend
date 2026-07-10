import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, LessThanOrEqual, Not, ObjectLiteral, Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { Club } from '@app/src/clubs/entities/club.entity'
import { Holding } from '@app/src/clubs/entities/holding.entity'
import { NotificationsService } from '@app/src/notifications/notifications.service'
import { NotificationRelatedTo, NotificationType } from '@app/src/notifications/enums'
import { Post, PostStatus } from './entities/post.entity'
import { PostLike } from './entities/post-like.entity'
import { PostRepost } from './entities/post-repost.entity'
import { PostBookmark } from './entities/post-bookmark.entity'
import { Trade } from './entities/trade.entity'
import { POST_SCHEDULER, PostScheduler } from './scheduler/scheduler.service'
import {
  BookmarkResultDto,
  CreatePostDto,
  FeedFilter,
  FeedResponseDto,
  FeedUserDto,
  MinePostsResponseDto,
  PaginatedPostsDto,
  PostDto,
  RepostResultDto,
  TradeActivityDto,
  TrendingItemDto,
  UpdatePostDto,
} from './dto'

/** Per-post computed stats + viewer-scoped flags used to build a PostDto. */
interface PostStatsView {
  likes: number
  comments: number
  reposts: number
  bookmarks: number
  liked: boolean
  reposted: boolean
  bookmarked: boolean
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(PostLike) private readonly likes: Repository<PostLike>,
    @InjectRepository(PostRepost) private readonly reposts: Repository<PostRepost>,
    @InjectRepository(PostBookmark) private readonly bookmarks: Repository<PostBookmark>,
    @InjectRepository(Trade) private readonly trades: Repository<Trade>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Club) private readonly clubs: Repository<Club>,
    @InjectRepository(Holding) private readonly holdings: Repository<Holding>,
    @Inject(POST_SCHEDULER) private readonly scheduler: PostScheduler,
    private readonly notifications: NotificationsService,
  ) {}

  /** Create a post authored by the JWT user. A `parentId` makes it a reply. */
  async createPost(authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const status = dto.status ?? PostStatus.PUBLISHED
    let scheduledAt: Date | null = dto.scheduledAt ? new Date(dto.scheduledAt) : null

    if (status === PostStatus.SCHEDULED) {
      scheduledAt = this.requireFuture(scheduledAt)
    }

    if (dto.parentId) await this.assertPost(dto.parentId)

    const post = await this.posts.save(
      this.posts.create({
        authorId,
        parentId: dto.parentId ?? null,
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

    if (post.status === PostStatus.PUBLISHED) {
      await this.notifyPostPublished(post)
    }

    return this.decorateOne(post, authorId)
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

    const items = await this.decoratePosts(rows, userId)
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
      if (prevStatus !== PostStatus.PUBLISHED) await this.notifyPostPublished(post)
    } else {
      // → draft (cancel a schedule) or a plain body edit on a draft.
      if (dto.scheduledAt !== undefined) post.scheduledAt = nextScheduledAt
      post.status = PostStatus.DRAFT
      if (prevStatus === PostStatus.SCHEDULED) this.scheduler.onCancelled(post.id)
    }

    const saved = await this.posts.save(post)
    return this.decorateOne(saved, userId)
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
    const wasPublished = post.status === PostStatus.PUBLISHED
    const wasScheduled = post.status === PostStatus.SCHEDULED
    post.status = PostStatus.PUBLISHED
    post.publishedAt = new Date()
    const saved = await this.posts.save(post)
    if (wasScheduled) this.scheduler.onCancelled(post.id)
    if (!wasPublished) await this.notifyPostPublished(saved)
    return this.decorateOne(saved, userId)
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
   * Idempotent single-post publish, used by the BullMQ post-publish processor.
   * The conditional UPDATE (id=? AND status='scheduled') means a retried job or
   * a concurrent cron sweep never double-publishes. Returns true iff this call
   * flipped the row to published.
   */
  async publishScheduledPost(postId: string): Promise<boolean> {
    const result = await this.posts.update(
      { id: postId, status: PostStatus.SCHEDULED },
      { status: PostStatus.PUBLISHED, publishedAt: () => 'now()' },
    )
    const published = (result.affected ?? 0) > 0
    if (published) {
      const post = await this.posts.findOne({ where: { id: postId } })
      if (post) await this.notifyPostPublished(post)
    }
    return published
  }

  /**
   * Best-effort POST_PUBLISHED fan-out to holders of the author's club. Resolves
   * the author's primary (first-created) club, gathers its distinct holder ids,
   * and hands them to `notifyMany` (which excludes the author + de-dupes). A
   * notification failure never breaks the underlying publish.
   */
  private async notifyPostPublished(post: Post): Promise<void> {
    try {
      const club = await this.clubs.findOne({
        where: { creatorId: post.authorId },
        order: { created: 'ASC' },
      })
      if (!club) return

      const holdings = await this.holdings.find({ where: { clubId: club.id } })
      const holderIds = [...new Set(holdings.map((h) => h.userId))]
      if (!holderIds.length) return

      const author = await this.users.findOne({ where: { id: post.authorId } })
      const actorName = author?.username ?? 'Someone'
      const excerpt = post.body.length > 140 ? `${post.body.slice(0, 137)}...` : post.body

      await this.notifications.notifyMany(holderIds, {
        type: NotificationType.POST_PUBLISHED,
        relatedTo: NotificationRelatedTo.POST,
        title: `${actorName} published a new post`,
        data: {
          actorId: post.authorId,
          actorName,
          actorAvatarUrl: author?.avatarUrl,
          clubId: club.id,
          postId: post.id,
          excerpt,
        },
      })
    } catch (err) {
      this.logger.warn(`POST_PUBLISHED notification failed: ${(err as Error).message}`)
    }
  }

  /**
   * Feed: `posts` → published top-level posts only (replies excluded);
   * `transactions` → trades only; `all` → both. `viewerId` (optional) drives the
   * per-viewer flags.
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

  /** A single post with viewer-scoped flags (public, viewer optional). */
  async getPost(id: string, viewerId?: string): Promise<PostDto> {
    const post = await this.posts.findOne({ where: { id } })
    if (!post) throw new NotFoundException('Post not found')
    return this.decorateOne(post, viewerId)
  }

  /** Direct replies (children) of a post, oldest-first for thread readability. */
  async listReplies(
    id: string,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<PaginatedPostsDto> {
    await this.assertPost(id)
    const [rows, total] = await this.posts.findAndCount({
      where: { parentId: id },
      order: { created: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    const items = await this.decoratePosts(rows, viewerId)
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 } }
  }

  // ---- Likes -------------------------------------------------------------

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

  // ---- Reposts -----------------------------------------------------------

  /** Repost (plain). Idempotent. Returns state + total repost count. */
  async repost(postId: string, userId: string): Promise<RepostResultDto> {
    await this.assertPost(postId)
    const existing = await this.reposts.findOne({ where: { postId, userId } })
    if (!existing) {
      await this.reposts.save(this.reposts.create({ postId, userId }))
    }
    return { reposted: true, reposts: await this.reposts.count({ where: { postId } }) }
  }

  /** Undo a repost. Returns state + total repost count. */
  async unrepost(postId: string, userId: string): Promise<RepostResultDto> {
    await this.assertPost(postId)
    await this.reposts.delete({ postId, userId })
    return { reposted: false, reposts: await this.reposts.count({ where: { postId } }) }
  }

  // ---- Bookmarks ---------------------------------------------------------

  /** Bookmark a post. Idempotent. Returns state + total bookmark count. */
  async bookmark(postId: string, userId: string): Promise<BookmarkResultDto> {
    await this.assertPost(postId)
    const existing = await this.bookmarks.findOne({ where: { postId, userId } })
    if (!existing) {
      await this.bookmarks.save(this.bookmarks.create({ postId, userId }))
    }
    return { bookmarked: true, bookmarks: await this.bookmarks.count({ where: { postId } }) }
  }

  /** Remove a bookmark. Returns state + total bookmark count. */
  async unbookmark(postId: string, userId: string): Promise<BookmarkResultDto> {
    await this.assertPost(postId)
    await this.bookmarks.delete({ postId, userId })
    return { bookmarked: false, bookmarks: await this.bookmarks.count({ where: { postId } }) }
  }

  /** The caller's bookmarked posts, newest-bookmarked first. */
  async listBookmarks(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedPostsDto> {
    const [rows, total] = await this.bookmarks.findAndCount({
      where: { userId },
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    const posts = await this.postsByIdsInOrder(rows.map((b) => b.postId))
    const items = await this.decoratePosts(posts, userId)
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 } }
  }

  // ---- Profile tabs ------------------------------------------------------

  /** A user's published top-level posts (replies excluded), newest first. */
  async listUserPosts(
    userId: string,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<PaginatedPostsDto> {
    return this.listAuthored(
      { authorId: userId, status: PostStatus.PUBLISHED, parentId: IsNull() },
      page,
      limit,
      viewerId,
    )
  }

  /** A user's published replies (posts with a parent), newest first. */
  async listUserReplies(
    userId: string,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<PaginatedPostsDto> {
    return this.listAuthored(
      { authorId: userId, status: PostStatus.PUBLISHED, parentId: Not(IsNull()) },
      page,
      limit,
      viewerId,
    )
  }

  /** Posts a user liked, newest-liked first. */
  async listUserLikes(
    userId: string,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<PaginatedPostsDto> {
    const [rows, total] = await this.likes.findAndCount({
      where: { userId },
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    const posts = await this.postsByIdsInOrder(rows.map((l) => l.postId))
    const items = await this.decoratePosts(posts, viewerId)
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 } }
  }

  /**
   * Search published, top-level posts by body (parameterized ILIKE), newest
   * first. Reuses the shared PostDto mapping so counts + viewer flags match the
   * feed. `viewerId` optional — flags are all-false when anonymous.
   */
  async searchPosts(q: string, limit = 10, viewerId?: string): Promise<PostDto[]> {
    const term = q.trim()
    if (!term) return []
    const rows = await this.posts
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere('p.parentId IS NULL')
      .andWhere('p.body ILIKE :like', { like: `%${term}%` })
      .orderBy('p.created', 'DESC')
      .take(limit)
      .getMany()
    return this.decoratePosts(rows, viewerId)
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
      where: { status: PostStatus.PUBLISHED, parentId: IsNull() },
      order: { created: 'DESC' },
      skip,
      take,
    })
    return this.decoratePosts(rows, viewerId)
  }

  /** Shared authored-post list (posts/replies tabs). */
  private async listAuthored(
    where: Record<string, unknown>,
    page: number,
    limit: number,
    viewerId?: string,
  ): Promise<PaginatedPostsDto> {
    const [rows, total] = await this.posts.findAndCount({
      where,
      order: { created: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    const items = await this.decoratePosts(rows, viewerId)
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 } }
  }

  /** Load posts by id preserving the given id order (drops missing ids). */
  private async postsByIdsInOrder(ids: string[]): Promise<Post[]> {
    if (!ids.length) return []
    const rows = await this.posts.find({ where: { id: In(ids) } })
    const byId = new Map(rows.map((p) => [p.id, p]))
    return ids.map((id) => byId.get(id)).filter((p): p is Post => !!p)
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

  private async decorateOne(post: Post, viewerId?: string): Promise<PostDto> {
    const [dto] = await this.decoratePosts([post], viewerId)
    return dto
  }

  /**
   * Map posts → PostDto[] resolving real counts (likes/comments/reposts/
   * bookmarks) and per-viewer flags (liked/reposted/bookmarked) with batched
   * `In(...)` queries — no N+1.
   */
  private async decoratePosts(rows: Post[], viewerId?: string): Promise<PostDto[]> {
    if (!rows.length) return []

    const postIds = rows.map((p) => p.id)
    const authors = await this.userMap(rows.map((p) => p.authorId))

    const [likeCounts, commentCounts, repostCounts, bookmarkCounts] = await Promise.all([
      this.countByPost(this.likes, postIds),
      this.countChildren(postIds),
      this.countByPost(this.reposts, postIds),
      this.countByPost(this.bookmarks, postIds),
    ])

    const likedSet = new Set<string>()
    const repostedSet = new Set<string>()
    const bookmarkedSet = new Set<string>()
    if (viewerId) {
      const [ml, mr, mb] = await Promise.all([
        this.likes.find({ where: { postId: In(postIds), userId: viewerId } }),
        this.reposts.find({ where: { postId: In(postIds), userId: viewerId } }),
        this.bookmarks.find({ where: { postId: In(postIds), userId: viewerId } }),
      ])
      ml.forEach((r) => likedSet.add(r.postId))
      mr.forEach((r) => repostedSet.add(r.postId))
      mb.forEach((r) => bookmarkedSet.add(r.postId))
    }

    return rows.map((p) =>
      this.toPostDto(
        p,
        {
          likes: likeCounts.get(p.id) ?? 0,
          comments: commentCounts.get(p.id) ?? 0,
          reposts: repostCounts.get(p.id) ?? 0,
          bookmarks: bookmarkCounts.get(p.id) ?? 0,
          liked: likedSet.has(p.id),
          reposted: repostedSet.has(p.id),
          bookmarked: bookmarkedSet.has(p.id),
        },
        authors,
      ),
    )
  }

  /** COUNT(*) grouped by `postId` over the given post ids → Map<postId, count>. */
  private async countByPost<T extends ObjectLiteral>(
    repo: Repository<T>,
    postIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    const rows = await repo
      .createQueryBuilder('x')
      .select('x.postId', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('x.postId IN (:...postIds)', { postIds })
      .groupBy('x.postId')
      .getRawMany<{ postId: string; count: string }>()
    rows.forEach((r) => map.set(r.postId, parseInt(r.count, 10)))
    return map
  }

  /** Comment counts: number of child posts per parent id. */
  private async countChildren(parentIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    const rows = await this.posts
      .createQueryBuilder('p')
      .select('p.parentId', 'parentId')
      .addSelect('COUNT(*)', 'count')
      .where('p.parentId IN (:...parentIds)', { parentIds })
      .groupBy('p.parentId')
      .getRawMany<{ parentId: string; count: string }>()
    rows.forEach((r) => map.set(r.parentId, parseInt(r.count, 10)))
    return map
  }

  private toPostDto(
    post: Post,
    stats: PostStatsView,
    authors: Map<string, FeedUserDto>,
  ): PostDto {
    return {
      id: post.id,
      author: authors.get(post.authorId) ?? this.unknownUser(post.authorId),
      body: post.body,
      createdAt: post.created.toISOString(),
      stats: {
        likes: stats.likes,
        comments: stats.comments,
        reposts: stats.reposts,
        shares: 0, // no share tracking yet
        bookmarks: stats.bookmarks,
      },
      liked: stats.liked,
      bookmarked: stats.bookmarked,
      reposted: stats.reposted,
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
