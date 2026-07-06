import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { IAuthUser } from '@app/shared/interfaces'
import { CoinMarketCapService } from './coin-market-cap.service'
import { QuotesQueryDto, TokenQuote } from './dto'

@ApiTags('Market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('market')
export class MarketController {
  constructor(private readonly cmc: CoinMarketCapService) {}

  @Get('quotes')
  @ApiOperation({ summary: 'CoinMarketCap USD quotes (price, 24h %, market cap, logo) for symbols' })
  async quotes(
    @Query() query: QuotesQueryDto,
    @CurrentUser() _user: IAuthUser,
  ): Promise<{ data: TokenQuote[] }> {
    // Parse the CSV: dedupe, uppercase, skip empties.
    const symbols = Array.from(
      new Set(
        query.symbols
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    )

    const data = await this.cmc.getQuotes(symbols)
    return { data }
  }
}
