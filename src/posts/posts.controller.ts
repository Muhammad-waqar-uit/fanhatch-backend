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
import { PostsService } from './posts.service'
import { CreatePostDto, FeedQueryDto, MinePostsQueryDto, UpdatePostDto } from './dto'

@ApiTags('Home')
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('posts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a post (author = JWT user)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.posts.createPost(userId, dto)
  }

  @Get('posts/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "The caller's posts (?status=&page=&limit=), newest first" })
  listMine(@CurrentUser('id') userId: string, @Query() query: MinePostsQueryDto) {
    return this.posts.listMine(userId, query.status, query.page, query.limit)
  }

  @Patch('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit / reschedule / cancel a post (author only)' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.updatePost(userId, id, dto)
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a post (author only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.deletePost(userId, id)
  }

  @Post('posts/:id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Force-publish a post now (author only)' })
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.publishPost(userId, id)
  }

  @Get('feed')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Feed (?filter=all|posts|transactions&page=&limit=)' })
  feed(@Query() query: FeedQueryDto, @CurrentUser('id') userId?: string) {
    return this.posts.feed(query.filter, query.page, query.limit, userId)
  }

  @Post('posts/:id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like a post' })
  like(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.like(id, userId)
  }

  @Delete('posts/:id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlike a post' })
  unlike(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.unlike(id, userId)
  }

  @Get('trending')
  @ApiOperation({ summary: 'Trending clubs ranked by memberCount/keyPrice' })
  trending() {
    return this.posts.trending()
  }
}
