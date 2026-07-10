import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { RedeemDto } from './dto'
import { ReferralsService } from './referrals.service'

@ApiTags('Referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  @ApiOperation({ summary: "The caller's referral code, link, reward tiles + stats" })
  me(@CurrentUser('id') userId: string) {
    return this.referrals.getMine(userId)
  }

  @Post('redeem')
  @ApiOperation({ summary: "Apply a referrer's code (one-time)" })
  redeem(@CurrentUser('id') userId: string, @Body() dto: RedeemDto) {
    return this.referrals.redeem(userId, dto.code)
  }
}
