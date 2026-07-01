import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { ChatRoomType } from './entities/chat-room.entity'
import { CreateDmDto, CreateRoomDto, QueryMessagesDto } from './dto'
import { RoomService } from './room.service'
import { MessageService } from './message.service'

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly rooms: RoomService,
    private readonly messages: MessageService,
  ) {}

  @Post('rooms')
  @ApiOperation({ summary: 'Create a club/group room (creator auto-joined as president)' })
  createRoom(@CurrentUser('id') userId: string, @Body() dto: CreateRoomDto) {
    return this.rooms.createRoom(userId, dto)
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List rooms the current user is in (?type=club|dm)' })
  listRooms(@CurrentUser('id') userId: string, @Query('type') type?: ChatRoomType) {
    return this.rooms.listMyRooms(userId, type)
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get a room by id' })
  getRoom(@Param('id') id: string) {
    return this.rooms.getRoomDto(id)
  }

  @Post('rooms/:id/join')
  @ApiOperation({ summary: 'Join a room (403 if not allowed)' })
  async join(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.rooms.join(userId, id)
    return { joined: true }
  }

  @Post('rooms/:id/leave')
  @ApiOperation({ summary: 'Leave a room' })
  async leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.rooms.leave(userId, id)
    return { left: true }
  }

  @Post('dm')
  @ApiOperation({ summary: 'Get-or-create a 1:1 DM room' })
  createDm(@CurrentUser('id') userId: string, @Body() dto: CreateDmDto) {
    return this.rooms.getOrCreateDm(userId, dto.peerUserId)
  }

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Cursor-paginated message history (newest → older)' })
  history(@Param('id') id: string, @Query() query: QueryMessagesDto) {
    return this.messages.history(id, query.cursor, query.limit)
  }
}
