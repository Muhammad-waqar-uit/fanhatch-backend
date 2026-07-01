import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

// ---- Request DTOs --------------------------------------------------------

export class ClaimRewardsDto {
  @ApiProperty({ enum: ['farm', 'club'] })
  @IsIn(['farm', 'club'])
  type: 'farm' | 'club'
}

// ---- Response DTO shapes (match the contract) ----------------------------

export class WalletBalancesDto {
  @ApiProperty() eth: string
  @ApiProperty() ethUsd: string
  @ApiProperty() fans: string
  @ApiProperty() fansUsd: string
}

export class WalletKeysSummaryDto {
  @ApiProperty() count: number
  @ApiProperty() valueUsd: string
}

export class WalletRewardsSummaryDto {
  @ApiProperty() farm: string
  @ApiProperty() club: string
}

export class WalletOverviewDto {
  @ApiProperty() netWorthUsd: string
  @ApiProperty() change24hPct: number
  @ApiProperty() fansPriceUsd: string
  @ApiProperty({ type: WalletBalancesDto }) balances: WalletBalancesDto
  @ApiProperty({ type: WalletKeysSummaryDto }) keys: WalletKeysSummaryDto
  @ApiProperty({ type: WalletRewardsSummaryDto }) rewards: WalletRewardsSummaryDto
}

export class KeyHoldingDto {
  @ApiProperty() clubId: string
  @ApiProperty() ftId: string
  @ApiProperty() name: string
  @ApiProperty() ticker: string
  @ApiProperty() keyCount: number
  @ApiProperty() keyPrice: string
  @ApiProperty() valueUsd: string
}

export class WalletRewardsDto {
  @ApiProperty() farmRewards: string
  @ApiProperty() clubRewards: string
  @ApiProperty() claimable: string
}

export class ClaimResultDto {
  @ApiProperty() claimed: string
  @ApiProperty() fansBalance: string
}
