import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard } from '@app/shared/auth'
import { MediaService } from './media.service'

/** Hard multer cap (memory-DoS guard) above the per-file soft limit enforced in the service. */
const MULTER_HARD_CAP = ((Number(process.env.MEDIA_MAX_MB) || 10) + 5) * 1024 * 1024

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image (multipart `file`, optional `folder`) → { url, key }' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_HARD_CAP } }))
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Body('folder') folder?: string,
  ) {
    return this.media.uploadImage(file, folder ?? 'misc', userId)
  }

  @Get('usage')
  @ApiOperation({ summary: 'Storage used vs the plan limit → { plan, usedBytes, limitBytes }' })
  usage(@CurrentUser('id') userId: string) {
    return this.media.usage(userId)
  }
}
