import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { OrderDirection } from '../enums'

/** Standard pagination + search query, extended by per-module query DTOs. */
export class PaginateDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orderBy?: string

  @ApiPropertyOptional({ enum: OrderDirection, default: OrderDirection.DESC })
  @IsEnum(OrderDirection)
  @IsOptional()
  order: OrderDirection = OrderDirection.DESC
}

/** Generic success envelope. */
export class SuccessRO<T = unknown> {
  @ApiProperty({ example: true })
  success = true

  @ApiPropertyOptional()
  message?: string

  @ApiPropertyOptional()
  data?: T
}

export class PaginationMetaRO {
  @ApiProperty() total: number
  @ApiProperty() page: number
  @ApiProperty() limit: number
  @ApiProperty() totalPages: number
}

/** Paginated list envelope. */
export class PaginateRO<T = unknown> {
  @ApiProperty({ isArray: true }) items: T[]
  @ApiProperty({ type: PaginationMetaRO }) meta: PaginationMetaRO
}
