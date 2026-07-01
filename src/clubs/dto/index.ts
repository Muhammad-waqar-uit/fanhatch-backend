import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
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
