import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { PostDto } from '@app/src/posts/dto'

// ---- Request DTOs --------------------------------------------------------

/** Shared `?limit=` query for the trending-clubs / creators lists. */
export class DiscoverLimitQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, description: 'Max items to return' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

/** `?q=` query for universal search (empty → all-empty result). */
export class DiscoverSearchQueryDto {
  @ApiPropertyOptional({ description: 'Search term (matches club name/ticker, username, post body)' })
  @IsOptional()
  @IsString()
  q?: string
}

// ---- Response DTO shapes --------------------------------------------------

/** A trending club card (also used for the `clubs` bucket of search). */
export class DiscoverTrendingClubDto {
  @ApiProperty() id: string
  @ApiProperty() clubId: number
  @ApiProperty() name: string
  @ApiProperty() ticker: string
  @ApiProperty() ftId: string
  @ApiProperty({ description: 'Current web2 key price (numeric string, matches ClubDto.keyPrice)' })
  keyPrice: string
  @ApiProperty() memberCount: number
  @ApiProperty({ description: '24h price change % — 0 until a price history series exists' })
  changePct: number
}

/** A suggested creator card (also used for the `creators` bucket of search). */
export class DiscoverCreatorDto {
  @ApiProperty() id: string
  @ApiProperty({ description: 'Maps from user.username' }) name: string
  @ApiProperty({ description: 'Maps from user.username' }) handle: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiPropertyOptional() bio?: string
  @ApiProperty({ description: 'Total follower count' }) followers: number
}

/** Universal search result — three capped buckets. */
export class DiscoverSearchResultDto {
  @ApiProperty({ type: [DiscoverTrendingClubDto] }) clubs: DiscoverTrendingClubDto[]
  @ApiProperty({ type: [DiscoverCreatorDto] }) creators: DiscoverCreatorDto[]
  @ApiProperty({ type: [PostDto] }) posts: PostDto[]
}
