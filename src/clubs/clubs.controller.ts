import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { ClubsService } from './clubs.service'
import { BuyKeysDto, CreateClubDto, GiftKeyDto, QueryClubsDto, VotePresidentDto } from './dto'

@ApiTags('Clubs')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a club (creator auto-holds key 1, chat room created)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateClubDto) {
    return this.clubs.createClub(userId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'List clubs (?search=&sort=trending|new|price&page=&limit=)' })
  list(@Query() query: QueryClubsDto) {
    return this.clubs.list(query)
  }

  @Get('ft/:ftId')
  @ApiOperation({ summary: 'Get a club by its FT id' })
  getByFtId(@Param('ftId') ftId: string) {
    return this.clubs.getByFtId(ftId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a club by id' })
  getClub(@Param('id') id: string) {
    return this.clubs.getClub(id)
  }

  @Get(':id/price')
  @ApiOperation({ summary: 'Web2 curve price estimate (?supply=; est. at 50 for the picker)' })
  price(
    @Param('id') id: string,
    @Query('supply', new ParseIntPipe({ optional: true })) supply?: number,
  ) {
    return this.clubs.priceEstimate(id, supply)
  }

  @Post(':id/keys/buy')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Web2 buy simulation: updates supply + holdings' })
  buy(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: BuyKeysDto) {
    return this.clubs.buyKeys(id, userId, dto.amount)
  }

  @Post(':id/keys/gift')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Web2 gift simulation: transfer keys to another user (supply unchanged)' })
  gift(@CurrentUser('id') fromUserId: string, @Param('id') id: string, @Body() dto: GiftKeyDto) {
    return this.clubs.giftKey(fromUserId, id, dto.toUserId, dto.amount ?? 1)
  }

  @Post(':id/president/vote')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Web2 governance: vote for president (weight = keys held)' })
  voteForPresident(
    @CurrentUser('id') voterId: string,
    @Param('id') id: string,
    @Body() dto: VotePresidentDto,
  ) {
    return this.clubs.voteForPresident(voterId, id, dto.candidateId)
  }

  @Get(':id/president')
  @ApiOperation({ summary: 'Get the elected president + vote standings' })
  getPresident(@Param('id') id: string) {
    return this.clubs.getPresident(id)
  }
}
