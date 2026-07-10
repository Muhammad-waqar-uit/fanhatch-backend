import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { SubscribeDto } from './dto'
import { PremiumService } from './premium.service'

@ApiTags('Premium')
@Controller('premium')
export class PremiumController {
  constructor(private readonly premium: PremiumService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans (Free / Premium / Pro)' })
  plans() {
    return this.premium.getPlans()
  }

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "The caller's current plan" })
  subscription(@CurrentUser('id') userId: string) {
    return this.premium.getSubscription(userId)
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Select a plan (no payment — records the tier)' })
  subscribe(@CurrentUser('id') userId: string, @Body() dto: SubscribeDto) {
    return this.premium.subscribe(userId, dto.planId)
  }
}
