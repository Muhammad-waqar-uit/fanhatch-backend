import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { PostStatus } from '../entities/post.entity'
import { TradeSide } from '../entities/trade.entity'

// ---- Request DTOs --------------------------------------------------------

export class CreatePostDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  body: string

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus

  @ApiPropertyOptional({ description: 'ISO timestamp, required for scheduled posts' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string

  @ApiPropertyOptional({ type: [String], description: "Platforms to cross-post to, e.g. ['x']" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  crossPostTargets?: string[]
}

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string

  @ApiPropertyOptional({ enum: PostStatus, description: 'Target status (draft/scheduled/published)' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus

  @ApiPropertyOptional({ description: 'ISO timestamp, required (and must be future) when status=scheduled' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string
}

export class MinePostsQueryDto {
  @ApiPropertyOptional({ enum: PostStatus, description: 'Filter by publication status' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20
}

export enum FeedFilter {
  ALL = 'all',
  POSTS = 'posts',
  TRANSACTIONS = 'transactions',
}

export class FeedQueryDto {
  @ApiPropertyOptional({ enum: FeedFilter, default: FeedFilter.ALL })
  @IsOptional()
  @IsEnum(FeedFilter)
  filter: FeedFilter = FeedFilter.ALL

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20
}

// ---- Response DTO shapes (mirror the frontend dashboard types exactly) ----

export class FeedUserDto {
  @ApiProperty() id: string
  @ApiProperty() name: string
  @ApiProperty() handle: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiPropertyOptional() verified?: boolean
}

export class PostStatsDto {
  @ApiProperty() likes: number
  @ApiProperty() comments: number
  @ApiProperty() reposts: number
  @ApiProperty() shares: number
  @ApiProperty() bookmarks: number
}

export class ClubPricePointDto {
  @ApiProperty() t: number
  @ApiProperty() price: number
}

export class ClubPriceDto {
  @ApiProperty() ticker: string
  @ApiProperty() priceEth: number
  @ApiProperty() changePct: number
  @ApiProperty() tradingValueEth: number
  @ApiProperty({ type: [ClubPricePointDto] }) history: ClubPricePointDto[]
}

export class PostDto {
  @ApiProperty() id: string
  @ApiProperty({ type: FeedUserDto }) author: FeedUserDto
  @ApiProperty() body: string
  @ApiProperty({ description: 'ISO timestamp' }) createdAt: string
  @ApiProperty({ type: PostStatsDto }) stats: PostStatsDto
  @ApiPropertyOptional() liked?: boolean
  @ApiPropertyOptional() bookmarked?: boolean
  @ApiPropertyOptional() reposted?: boolean
  @ApiPropertyOptional({ type: ClubPriceDto }) club?: ClubPriceDto
}

export class TradeActivityDto {
  @ApiProperty() id: string
  @ApiProperty({ type: FeedUserDto }) user: FeedUserDto
  @ApiProperty({ enum: TradeSide }) side: TradeSide
  @ApiProperty({ description: 'Number of keys traded' }) amount: number
  @ApiProperty() ticker: string
  @ApiProperty() priceEth: number
  @ApiProperty({ description: 'ISO timestamp' }) createdAt: string
}

export class FeedResponseDto {
  @ApiProperty({ type: [PostDto] }) posts: PostDto[]
  @ApiProperty({ type: [TradeActivityDto] }) trades: TradeActivityDto[]
}

export class TrendingItemDto {
  @ApiProperty() id: string
  @ApiProperty() name: string
  @ApiProperty() handle: string
  @ApiProperty() ticker: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiProperty() priceEth: number
  @ApiProperty() changePct: number
}

export class LikeResultDto {
  @ApiProperty() liked: boolean
  @ApiProperty() likes: number
}

export class MinePostsMetaDto {
  @ApiProperty() total: number
  @ApiProperty() page: number
  @ApiProperty() limit: number
  @ApiProperty() totalPages: number
}

/** Paginated envelope for `GET /posts/me`. */
export class MinePostsResponseDto {
  @ApiProperty({ type: [PostDto] }) items: PostDto[]
  @ApiProperty({ type: MinePostsMetaDto }) meta: MinePostsMetaDto
}
