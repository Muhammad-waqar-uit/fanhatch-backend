import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, OptionalJwtAuthGuard } from '@app/shared/auth'
import { DiscoverService } from './discover.service'
import { DiscoverLimitQueryDto, DiscoverSearchQueryDto } from './dto'

/**
 * Read-only discovery surface: trending clubs, suggested creators and universal
 * search — aggregation over existing clubs/users/posts/follows data.
 */
@ApiTags('Discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Get('trending-clubs')
  @ApiOperation({ summary: 'Trending clubs by memberCount (tiebreak supply), default limit 12' })
  trendingClubs(@Query() query: DiscoverLimitQueryDto) {
    return this.discover.trendingClubs(query.limit ?? 12)
  }

  @Get('creators')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Suggested creators by follower count; excludes the viewer + who they follow',
  })
  creators(@Query() query: DiscoverLimitQueryDto, @CurrentUser('id') viewerId?: string) {
    return this.discover.creators(query.limit ?? 10, viewerId)
  }

  @Get('search')
  @ApiOperation({ summary: 'Universal search across clubs, creators and posts (empty q → empty)' })
  search(@Query() query: DiscoverSearchQueryDto) {
    return this.discover.search(query.q)
  }
}
