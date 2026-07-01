import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsNumberString, IsOptional } from 'class-validator'

// ---- Request DTOs --------------------------------------------------------

export class QuoteDto {
  @ApiProperty({ enum: ['swap', 'add'] })
  @IsIn(['swap', 'add'])
  action: 'swap' | 'add'

  @ApiPropertyOptional({ enum: ['eth_to_fans', 'fans_to_eth'] })
  @IsOptional()
  @IsIn(['eth_to_fans', 'fans_to_eth'])
  direction?: 'eth_to_fans' | 'fans_to_eth'

  @ApiPropertyOptional({ description: 'ETH to add (action=add)' })
  @IsOptional()
  @IsNumberString()
  ethIn?: string

  @ApiPropertyOptional({ description: 'FANS to add (action=add)' })
  @IsOptional()
  @IsNumberString()
  fansIn?: string

  @ApiPropertyOptional({ description: 'Amount in (action=swap)' })
  @IsOptional()
  @IsNumberString()
  amountIn?: string
}

export class AddLiquidityDto {
  @ApiProperty({ description: 'ETH amount to deposit' })
  @IsNumberString()
  ethIn: string

  @ApiProperty({ description: 'FANS amount to deposit' })
  @IsNumberString()
  fansIn: string
}

export class RemoveLiquidityDto {
  @ApiProperty({ description: 'LP shares to burn' })
  @IsNumberString()
  shares: string
}

export class SwapDto {
  @ApiProperty({ enum: ['eth_to_fans', 'fans_to_eth'] })
  @IsIn(['eth_to_fans', 'fans_to_eth'])
  direction: 'eth_to_fans' | 'fans_to_eth'

  @ApiProperty({ description: 'Amount of the input token' })
  @IsNumberString()
  amountIn: string

  @ApiPropertyOptional({ description: 'Minimum acceptable output (slippage guard)' })
  @IsOptional()
  @IsNumberString()
  minOut?: string
}

export class StakeDto {
  @ApiProperty({ description: 'LP shares to stake' })
  @IsNumberString()
  shares: string
}

export class UnstakeDto {
  @ApiProperty({ description: 'LP shares to unstake' })
  @IsNumberString()
  shares: string
}

// ---- Response DTO shapes (match the contract) ----------------------------

export class PoolDto {
  @ApiProperty() reserveEth: string
  @ApiProperty() reserveFans: string
  @ApiProperty() fansPerEth: string
  @ApiProperty() totalShares: string
}

export class PositionDto {
  @ApiProperty() shares: string
  @ApiProperty() ethShare: string
  @ApiProperty() fansShare: string
  @ApiProperty() valueUsd: string
}

export class QuoteResultDto {
  @ApiPropertyOptional() amountOut?: string
  @ApiPropertyOptional() sharesOut?: string
  @ApiPropertyOptional() priceImpactPct?: number
}

export class AddResultDto {
  @ApiProperty() shares: string
  @ApiProperty({ type: PositionDto }) position: PositionDto
}

export class RemoveResultDto {
  @ApiProperty() ethOut: string
  @ApiProperty() fansOut: string
}

export class SwapResultDto {
  @ApiProperty() amountOut: string
  @ApiProperty({ type: PoolDto }) pool: PoolDto
}

export class FarmDto {
  @ApiProperty() staked: string
  @ApiProperty() earned: string
}

export class ClaimResultDto {
  @ApiProperty() claimed: string
  @ApiProperty() fansBalance: string
}
