/**
 * Standalone seed script — populates real-mode chat + clubs so the app isn't
 * empty when you point the frontend at a live backend.
 *
 * Inserts: 2 demo users, 2 clubs (each with its chat room + creator holding),
 * one DM between the two users, and a few messages.
 *
 * Run (from the backend root, with a reachable Postgres + the schema migrated):
 *
 *   npx ts-node src/seed/seed-chat-clubs.ts
 *
 * It builds its own DataSource from the same TYPEORM_* env vars as data-source.ts
 * (loaded via dotenv), so it does not need the Nest app running. Idempotent: it
 * skips creation when the demo users already exist.
 */
import 'reflect-metadata'
import 'dotenv/config'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from '../users/user.entity'
import { Club, ClubCurveType } from '../clubs/entities/club.entity'
import { Holding } from '../clubs/entities/holding.entity'
import { Follow } from '../social/entities/follow.entity'
import { ChatRoom, ChatRoomType } from '../chat/entities/chat-room.entity'
import { RoomMember, RoomMemberRole } from '../chat/entities/room-member.entity'
import { ChatMessage, ChatMessageType } from '../chat/entities/chat-message.entity'
import { LpPool } from '../lp/entities/lp-pool.entity'
import { Post, PostStatus } from '../posts/entities/post.entity'
import { Trade, TradeSide } from '../posts/entities/trade.entity'
import { estimatePrice } from '../clubs/curve.util'

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_DB_HOST || 'localhost',
  port: parseInt(process.env.TYPEORM_PORT || '5432', 10),
  username: process.env.TYPEORM_USERNAME || 'postgres',
  password: process.env.TYPEORM_PASSWORD || 'postgres',
  database: process.env.TYPEORM_DATABASE || 'fanstech',
  entities: [User, Club, Holding, Follow, ChatRoom, RoomMember, ChatMessage, LpPool, Post, Trade],
  synchronize: false,
  logging: false,
  ssl: process.env.TYPEORM_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

const money = (n: number): string => n.toFixed(8)

async function main(): Promise<void> {
  await dataSource.initialize()
  console.log('[seed] connected')

  const users = dataSource.getRepository(User)
  const clubs = dataSource.getRepository(Club)
  const holdings = dataSource.getRepository(Holding)
  const rooms = dataSource.getRepository(ChatRoom)
  const members = dataSource.getRepository(RoomMember)
  const messages = dataSource.getRepository(ChatMessage)

  if (await users.findOne({ where: { email: 'alice@fans.tech' } })) {
    console.log('[seed] demo users already exist — nothing to do')
    await dataSource.destroy()
    return
  }

  const passwordHash = await bcrypt.hash('password123', 10)
  // Web2-simulated balances so Wallet/LP have something to trade.
  const alice = await users.save(
    users.create({
      email: 'alice@fans.tech', username: 'alice', passwordHash, bio: 'Founder #1',
      ethBalance: money(2), fansBalance: money(5000),
    }),
  )
  const bob = await users.save(
    users.create({
      email: 'bob@fans.tech', username: 'bob', passwordHash, bio: 'Founder #2',
      ethBalance: money(1.5), fansBalance: money(3000),
    }),
  )
  console.log('[seed] users:', alice.username, bob.username)

  // --- Clubs (+ chat room + creator holding) --------------------------------
  const clubSpecs = [
    { creator: alice, name: 'Alice Club', ticker: '$ALICE', curveType: ClubCurveType.CASUAL },
    { creator: bob, name: 'Bob Club', ticker: '$BOB', curveType: ClubCurveType.EXCLUSIVE },
  ]

  const maxRow = await clubs
    .createQueryBuilder('c')
    .select('MAX(c.clubId)', 'max')
    .getRawOne<{ max: string | null }>()
  let nextClubId = (maxRow?.max ? parseInt(maxRow.max, 10) : 0) + 1

  for (const spec of clubSpecs) {
    const clubId = nextClubId++
    const club = await clubs.save(
      clubs.create({
        clubId,
        ftId: `FT${clubId}`,
        name: spec.name,
        ticker: spec.ticker,
        curveType: spec.curveType,
        creatorId: spec.creator.id,
        supply: 1,
        keyPrice: money(estimatePrice(spec.curveType, 1)),
        memberCount: 1,
      }),
    )
    await holdings.save(holdings.create({ userId: spec.creator.id, clubId: club.id, keyCount: 1 }))

    const room = await rooms.save(
      rooms.create({
        type: ChatRoomType.CLUB,
        name: club.name,
        clubId: club.id,
        createdById: spec.creator.id,
      }),
    )
    await members.save(
      members.create({ roomId: room.id, userId: spec.creator.id, role: RoomMemberRole.PRESIDENT }),
    )
    await messages.save(
      messages.create({
        roomId: room.id,
        senderId: spec.creator.id,
        type: ChatMessageType.TEXT,
        body: `Welcome to ${club.name}!`,
      }),
    )
    console.log('[seed] club:', club.ftId, club.name)
  }

  // --- DM between alice and bob --------------------------------------------
  const dm = await rooms.save(
    rooms.create({ type: ChatRoomType.DM, name: 'Direct Message', createdById: alice.id }),
  )
  await members.save([
    members.create({ roomId: dm.id, userId: alice.id, role: RoomMemberRole.MEMBER }),
    members.create({ roomId: dm.id, userId: bob.id, role: RoomMemberRole.MEMBER }),
  ])
  await messages.save([
    messages.create({ roomId: dm.id, senderId: alice.id, body: 'Hey Bob!' }),
    messages.create({ roomId: dm.id, senderId: bob.id, body: 'Hi Alice, love the club.' }),
  ])
  console.log('[seed] dm + messages created')

  // --- LP pool (singleton) — reserves so swap/quote/net-worth are meaningful ---
  const pools = dataSource.getRepository(LpPool)
  if (!(await pools.findOne({ where: {} }))) {
    // 10 ETH : 1,000,000 FANS  => fansPerEth = 100k, $FANS ≈ $0.03 (ETH=$3000)
    await pools.save(
      pools.create({ reserveEth: money(10), reserveFans: money(1_000_000), totalShares: money(100_000) }),
    )
    console.log('[seed] lp pool created')
  }

  // --- Sample posts (Home feed) --------------------------------------------
  const posts = dataSource.getRepository(Post)
  await posts.save([
    posts.create({ authorId: alice.id, body: 'gm — Alice Club keys are live. First key was free 👑', status: PostStatus.PUBLISHED }),
    posts.create({ authorId: bob.id, body: 'Just aped into a few clubs. The bonding curve UX is smooth.', status: PostStatus.PUBLISHED }),
    posts.create({ authorId: alice.id, body: 'Scheduling a big drop for the weekend.', status: PostStatus.PUBLISHED }),
  ])

  // --- Sample trades (Transactions filter) ----------------------------------
  const trades = dataSource.getRepository(Trade)
  const aliceClub = await clubs.findOne({ where: { ticker: '$ALICE' } })
  const bobClub = await clubs.findOne({ where: { ticker: '$BOB' } })
  if (aliceClub && bobClub) {
    await trades.save([
      trades.create({ actorId: bob.id, clubId: aliceClub.id, ticker: aliceClub.ticker, side: TradeSide.BUY, amount: 2, pricePerKey: aliceClub.keyPrice }),
      trades.create({ actorId: alice.id, clubId: bobClub.id, ticker: bobClub.ticker, side: TradeSide.BUY, amount: 1, pricePerKey: bobClub.keyPrice }),
    ])
  }
  console.log('[seed] posts + trades created')

  await dataSource.destroy()
  console.log('[seed] done')
}

main().catch((err) => {
  console.error('[seed] failed:', err)
  process.exitCode = 1
})
