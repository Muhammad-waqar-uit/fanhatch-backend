import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { WalletService } from './wallet.service'
import { ClaimRewardsDto } from './dto'

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Net worth, balances, keys + rewards summary' })
  overview(@CurrentUser('id') userId: string) {
    return this.wallet.overview(userId)
  }

  @Get('keys')
  @ApiOperation({ summary: "Caller's key holdings joined to clubs" })
  keys(@CurrentUser('id') userId: string) {
    return this.wallet.keys(userId)
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Farm + club rewards and total claimable' })
  rewards(@CurrentUser('id') userId: string) {
    return this.wallet.rewards(userId)
  }

  @Post('rewards/claim')
  @ApiOperation({ summary: 'Claim farm or club rewards → adds to fansBalance' })
  claim(@CurrentUser('id') userId: string, @Body() dto: ClaimRewardsDto) {
    return this.wallet.claim(userId, dto)
  }
}
