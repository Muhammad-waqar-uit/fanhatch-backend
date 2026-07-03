import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { QueryUsersDto, SetWalletDto, UpdateUserDto } from './dto'
import { UsersService } from './users.service'

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (paginated, ?search=)' })
  list(@Query() query: QueryUsersDto) {
    return this.usersService.paginate(query)
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser('id') userId: string) {
    return (await this.usersService.getProfile(userId)).toResponseObject()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  async findOne(@Param('id') id: string) {
    return (await this.usersService.getProfile(id)).toResponseObject()
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  async update(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return (await this.usersService.update(userId, dto)).toResponseObject()
  }

  @Patch('me/wallet')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Persist the caller smart-account / wallet address' })
  async setWallet(@CurrentUser('id') userId: string, @Body() dto: SetWalletDto) {
    return (await this.usersService.setWallet(userId, dto.walletAddress)).toResponseObject()
  }
}
