import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { LpService } from './lp.service'
import {
  AddLiquidityDto,
  QuoteDto,
  RemoveLiquidityDto,
  StakeDto,
  SwapDto,
  UnstakeDto,
} from './dto'

@ApiTags('LP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lp')
export class LpController {
  constructor(private readonly lp: LpService) {}

  @Get('pool')
  @ApiOperation({ summary: 'Pool reserves + price (simulates FansSwap pair)' })
  pool() {
    return this.lp.pool()
  }

  @Get('position')
  @ApiOperation({ summary: "Caller's LP position (shares + underlying value)" })
  position(@CurrentUser('id') userId: string) {
    return this.lp.position(userId)
  }

  @Post('quote')
  @ApiOperation({ summary: 'Quote a swap or add (amountOut / sharesOut / priceImpact)' })
  quote(@Body() dto: QuoteDto) {
    return this.lp.quote(dto)
  }

  @Post('add')
  @ApiOperation({ summary: 'Add liquidity — deducts balances, mints shares' })
  add(@CurrentUser('id') userId: string, @Body() dto: AddLiquidityDto) {
    return this.lp.add(userId, dto)
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remove liquidity — burns shares, returns eth+fans' })
  remove(@CurrentUser('id') userId: string, @Body() dto: RemoveLiquidityDto) {
    return this.lp.remove(userId, dto)
  }

  @Post('swap')
  @ApiOperation({ summary: 'Swap — moves balances + reserves (0.3% fee)' })
  swap(@CurrentUser('id') userId: string, @Body() dto: SwapDto) {
    return this.lp.swap(userId, dto)
  }

  @Get('farm')
  @ApiOperation({ summary: "Caller's farm position (simulates StakingManager)" })
  farmInfo(@CurrentUser('id') userId: string) {
    return this.lp.farm(userId)
  }

  @Post('farm/stake')
  @ApiOperation({ summary: 'Stake LP shares' })
  stake(@CurrentUser('id') userId: string, @Body() dto: StakeDto) {
    return this.lp.stake(userId, dto)
  }

  @Post('farm/unstake')
  @ApiOperation({ summary: 'Unstake LP shares' })
  unstake(@CurrentUser('id') userId: string, @Body() dto: UnstakeDto) {
    return this.lp.unstake(userId, dto)
  }

  @Post('farm/claim')
  @ApiOperation({ summary: 'Claim farm rewards → adds to fansBalance' })
  claim(@CurrentUser('id') userId: string) {
    return this.lp.claim(userId)
  }
}
