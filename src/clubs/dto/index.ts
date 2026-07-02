import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { PaginateDto } from '@app/shared/dto'
import { ClubCurveType } from '../entities/club.entity'

// ---- Request DTOs --------------------------------------------------------

export class ClubSocialsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  x?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string
}

export class CreateClubDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name: string

  @ApiProperty({ maxLength: 12, description: 'Ticker, e.g. $ACME' })
  @IsString()
  @MaxLength(12)
  ticker: string

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string

  @ApiProperty({ enum: ClubCurveType })
  @IsEnum(ClubCurveType)
  curveType: ClubCurveType

  @ApiPropertyOptional({ type: ClubSocialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClubSocialsDto)
  socials?: ClubSocialsDto

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Keys to mint on create (creator).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  firstKeyQty?: number
}

export class BuyKeysDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number
}

export class GiftKeyDto {
  @ApiProperty({ format: 'uuid', description: 'Recipient user id.' })
  @IsUUID()
  toUserId: string

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Keys to gift.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number
}

export class VotePresidentDto {
  @ApiProperty({ format: 'uuid', description: 'User id being voted for as president.' })
  @IsUUID()
  candidateId: string
}

export class QueryClubsDto extends PaginateDto {
  @ApiPropertyOptional({
    enum: ['trending', 'new', 'price'],
    description: 'trending → memberCount desc, new → newest, price → keyPrice desc',
  })
  @IsOptional()
  @IsString()
  sort?: 'trending' | 'new' | 'price'
}

// ---- Response DTO shapes (match the contract) ----------------------------

export class ClubCreatorDto {
  @ApiProperty() id: string
  @ApiProperty() handle: string
  @ApiProperty() name: string
}

export class ClubDto {
  @ApiProperty() id: string
  @ApiProperty() clubId: number
  @ApiProperty() ftId: string
  @ApiProperty() name: string
  @ApiProperty() ticker: string
  @ApiPropertyOptional() description?: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiProperty({ enum: ClubCurveType }) curveType: ClubCurveType
  @ApiProperty({ type: ClubCreatorDto }) creator: ClubCreatorDto
  @ApiPropertyOptional() socials?: { x?: string; email?: string; website?: string }
  @ApiProperty() supply: number
  @ApiProperty() keyPrice: string
  @ApiProperty() memberCount: number
  @ApiPropertyOptional() chatRoomId?: string
  @ApiProperty({ description: 'ISO timestamp' }) created: string
}

export class PriceEstimateDto {
  @ApiProperty() buyPrice: string
  @ApiProperty() sellPrice: string
  @ApiProperty() supply: number
}

export class BuyKeysResultDto {
  @ApiProperty() supply: number
  @ApiProperty() keyPrice: string
  @ApiProperty() holding: number
}

export class GiftKeyFromDto {
  @ApiProperty() keyCount: number
}

export class GiftKeyToDto {
  @ApiProperty() userId: string
  @ApiProperty() keyCount: number
}

export class GiftKeyClubDto {
  @ApiProperty() id: string
  @ApiProperty() memberCount: number
}

export class GiftKeyResultDto {
  @ApiProperty({ type: GiftKeyFromDto }) from: GiftKeyFromDto
  @ApiProperty({ type: GiftKeyToDto }) to: GiftKeyToDto
  @ApiProperty({ type: GiftKeyClubDto }) club: GiftKeyClubDto
}

// ---- Governance: vote-for-president --------------------------------------

export class VoteResultDto {
  @ApiProperty({ format: 'uuid' }) candidateId: string
  @ApiProperty({ description: 'Total vote weight (keys) for the candidate.' }) votes: number
  @ApiProperty({ description: 'Whether this vote elected the candidate.' }) elected: boolean
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Current president after the vote.' })
  presidentId?: string | null
}

export class PresidentCandidateDto {
  @ApiProperty() id: string
  @ApiProperty() handle: string
  @ApiProperty() name: string
}

export class PresidentStandingDto {
  @ApiProperty({ type: PresidentCandidateDto }) candidate: PresidentCandidateDto
  @ApiProperty({ description: 'Total vote weight (keys) for the candidate.' }) votes: number
}

export class PresidentDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) presidentId?: string | null
  @ApiPropertyOptional({ type: PresidentCandidateDto, nullable: true })
  president?: PresidentCandidateDto | null
  @ApiProperty() supply: number
  @ApiProperty({ type: [PresidentStandingDto] }) standings: PresidentStandingDto[]
}
