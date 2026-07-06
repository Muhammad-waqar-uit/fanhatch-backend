import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { NotificationsService } from './notifications.service'
import { ChangeSettingDto, QueryNotificationsDto } from './dto'

/**
 * All routes are owner-scoped: the recipient is always the JWT user
 * (`@CurrentUser('id')`), never taken from the body/params. Literal paths are
 * declared before the `:id` routes so `unread-count`, `read-all` and `settings`
 * are not swallowed by the param matcher.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller notifications (paginated, filterable)' })
  list(@CurrentUser('id') userId: string, @Query() query: QueryNotificationsDto) {
    return this.notifications.list(userId, query)
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread counts grouped by relatedTo (0-seeded) + total' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId)
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId)
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get per-type notification settings (default true)' })
  getSettings(@CurrentUser('id') userId: string) {
    return this.notifications.getSettings(userId)
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Toggle one notification setting type' })
  changeSetting(@CurrentUser('id') userId: string, @Body() dto: ChangeSettingDto) {
    return this.notifications.changeSetting(userId, dto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification' })
  getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notifications.getOne(id, userId)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(id, userId)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete one notification' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.notifications.remove(id, userId)
    return { success: true }
  }
}
