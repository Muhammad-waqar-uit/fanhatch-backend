import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { PaginateDto } from '@app/shared/dto'

// ---- Request DTOs --------------------------------------------------------

export class ProfileSocialsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  x?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farcaster?: string
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string

  @ApiPropertyOptional({ type: ProfileSocialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileSocialsDto)
  socials?: ProfileSocialsDto
}

// ---- Response DTO shapes (match the contract) ----------------------------

export class ProfileStatsDto {
  @ApiProperty() holders: number
  @ApiProperty() holding: number
  @ApiProperty() followers: number
  @ApiProperty() following: number
}

export type ViewerRelation = 'self' | 'following' | 'other' | 'anonymous'

export class ProfileDto {
  @ApiProperty() id: string
  @ApiProperty() handle: string
  @ApiProperty() displayName: string
  @ApiProperty() userNumber: number
  @ApiPropertyOptional() bio?: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiPropertyOptional() walletAddress?: string
  @ApiPropertyOptional() socials?: { x?: string; farcaster?: string }
  @ApiProperty({ type: ProfileStatsDto }) stats: ProfileStatsDto
  @ApiPropertyOptional() keyPrice?: string
  @ApiPropertyOptional() ownKeyCount?: number
  @ApiProperty({ enum: ['self', 'following', 'other', 'anonymous'] })
  viewerRelation: ViewerRelation
  @ApiProperty({ description: 'ISO timestamp the user joined (user.created)' }) joinedAt: string
  @ApiPropertyOptional({ description: 'ISO timestamp' }) lastSeen?: string
}

export class UserCardDto {
  @ApiProperty() id: string
  @ApiProperty() handle: string
  @ApiProperty() displayName: string
  @ApiPropertyOptional() avatarUrl?: string
}

export class ClubCardDto {
  @ApiProperty() id: string
  @ApiProperty() ftId: string
  @ApiProperty() name: string
  @ApiProperty() ticker: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiProperty() keyPrice: string
  @ApiPropertyOptional() description?: string
}

export class ActivityDto {
  @ApiProperty() id: string
  @ApiProperty({ enum: ['buy', 'sell', 'gift', 'post', 'president'] })
  type: 'buy' | 'sell' | 'gift' | 'post' | 'president'
  @ApiProperty({ description: 'ISO timestamp' }) ts: string
  @ApiProperty() summary: string
}

export class ActivityQueryDto extends PaginateDto {}
export class FollowListQueryDto extends PaginateDto {}
