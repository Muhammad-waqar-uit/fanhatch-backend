import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { UserPlan } from '@app/shared/enums'

export class SubscribeDto {
  @ApiProperty({ enum: UserPlan })
  @IsEnum(UserPlan)
  planId: UserPlan
}

export class PlanDto {
  @ApiProperty({ enum: UserPlan }) id: UserPlan
  @ApiProperty() name: string
  @ApiProperty() price: number
  @ApiProperty() period: string
  @ApiProperty({ type: [String] }) features: string[]
}

export class SubscriptionDto {
  @ApiProperty({ enum: UserPlan }) plan: UserPlan
  @ApiProperty({ nullable: true }) since: string | null
}
