import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

/** Query for GET /market/quotes — a CSV of ticker symbols (e.g. "ETH,BTC"). */
export class QuotesQueryDto {
  @ApiProperty({ example: 'ETH,BTC', description: 'Comma-separated token symbols' })
  @IsString()
  @IsNotEmpty()
  symbols: string
}

/** A single token price quote, sourced from CoinMarketCap. */
export class TokenQuote {
  @ApiProperty({ example: 'ETH' })
  symbol: string

  @ApiProperty({ example: 'Ethereum' })
  name: string

  @ApiProperty({ example: 3421.55, description: 'Spot price in USD' })
  price: number

  @ApiProperty({ example: -1.23, description: '24h price change, percent' })
  percentChange24h: number

  @ApiProperty({ example: 411_000_000_000, description: 'Market capitalisation in USD' })
  marketCap: number

  @ApiPropertyOptional({ example: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' })
  logoUrl?: string
}
