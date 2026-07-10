import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class RedeemDto {
  @ApiProperty({ description: "The referrer's code, e.g. FANS2026" })
  @IsString()
  @IsNotEmpty()
  code: string
}

export class ReferralRewardDto {
  @ApiProperty() key: string
  @ApiProperty() label: string
  @ApiProperty() sub: string
}

export class ReferralMeDto {
  @ApiProperty() code: string
  @ApiProperty() link: string
  @ApiProperty({ type: [ReferralRewardDto] }) rewards: ReferralRewardDto[]
  @ApiProperty() stats: { invited: number; rewardsUsdt: number; tokenBonus: number }
}
