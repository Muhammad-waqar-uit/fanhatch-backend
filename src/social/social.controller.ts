import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard, OptionalJwtAuthGuard } from '@app/shared/auth'
import { IAuthUser } from '@app/shared/interfaces'
import { PostsService } from '@app/src/posts/posts.service'
import { PageQueryDto } from '@app/src/posts/dto'
import { SocialService } from './social.service'
import { ActivityQueryDto, FollowListQueryDto, UpdateProfileDto } from './dto'

/**
 * Social/profile endpoints mounted at `/users`, alongside the existing
 * UsersController. To avoid route collisions the profile-by-handle lookup lives
 * at `/users/handle/:handle` (UsersController owns `/users/:id`) and the profile
 * update lives at `/users/me/profile` (UsersController owns `PATCH /users/me`).
 */
@ApiTags('Social')
@Controller('users')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly posts: PostsService,
  ) {}

  @Get('handle/:handle')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Profile by handle (viewerRelation reflects the caller)' })
  profile(@Param('handle') handle: string, @CurrentUser() viewer?: IAuthUser) {
    return this.social.profileByHandle(handle, viewer?.id)
  }

  @Patch('me/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.social.updateMe(userId, dto)
  }

  @Post(':id/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Follow a user (409 on self-follow)' })
  follow(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.social.follow(userId, id)
  }

  @Delete(':id/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.social.unfollow(userId, id)
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Users following this user (paginated)' })
  followers(@Param('id') id: string, @Query() query: FollowListQueryDto) {
    return this.social.followers(id, query.page, query.limit)
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Users this user follows (paginated)' })
  following(@Param('id') id: string, @Query() query: FollowListQueryDto) {
    return this.social.following(id, query.page, query.limit)
  }

  @Get(':id/clubs')
  @ApiOperation({ summary: 'Clubs this user created' })
  clubs(@Param('id') id: string) {
    return this.social.clubsCreated(id)
  }

  @Get(':id/holding')
  @ApiOperation({ summary: 'Clubs this user holds keys in' })
  holdingClubs(@Param('id') id: string) {
    return this.social.holding(id)
  }

  @Get(':id/holders')
  @ApiOperation({ summary: "Users who hold this user's club keys" })
  holders(@Param('id') id: string) {
    return this.social.holders(id)
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Activity feed (trades/posts — stub for now)' })
  activity(@Param('id') id: string, @Query() query: ActivityQueryDto) {
    return this.social.activity(id, query.page, query.limit)
  }

  @Get(':id/posts')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "A user's top-level posts (replies excluded, paginated)" })
  userPosts(
    @Param('id') id: string,
    @Query() query: PageQueryDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    return this.posts.listUserPosts(id, query.page, query.limit, viewerId)
  }

  @Get(':id/replies')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "A user's replies (paginated)" })
  userReplies(
    @Param('id') id: string,
    @Query() query: PageQueryDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    return this.posts.listUserReplies(id, query.page, query.limit, viewerId)
  }

  @Get(':id/likes')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Posts a user liked (paginated)' })
  userLikes(
    @Param('id') id: string,
    @Query() query: PageQueryDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    return this.posts.listUserLikes(id, query.page, query.limit, viewerId)
  }
}
