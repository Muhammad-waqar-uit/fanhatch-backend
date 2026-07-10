import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '@app/src/users/user.entity'
import { storageLimitBytes } from '@app/src/premium/plan-entitlements'
import sharp from 'sharp'
import { MediaAsset } from './entities/media-asset.entity'
import { STORAGE_DRIVER, type StorageDriver, type UploadResult } from './storage/storage.interface'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Per-file cap (default 10MB). */
const MAX_BYTES = (Number(process.env.MEDIA_MAX_MB) || 10) * 1024 * 1024
/** Longest edge after resize — keeps avatars/photos light without cloud transforms. */
const MAX_EDGE = 1600

export interface StorageUsage {
  plan: string
  usedBytes: number
  limitBytes: number
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async uploadImage(
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    folder: string,
    userId: string,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file uploaded')
    const ext = MIME_EXT[file.mimetype]
    if (!ext) throw new BadRequestException('Unsupported type — png, jpeg, webp or gif only')
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException(`File too large — max ${MAX_BYTES / 1024 / 1024}MB`)
    }

    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '') || 'misc'
    const optimized = await this.optimize(file.buffer, file.mimetype)
    const bytes = optimized.length

    // Plan storage quota: reject if this upload would exceed the user's allowance.
    const { usedBytes, limitBytes, plan } = await this.usage(userId)
    if (usedBytes + bytes > limitBytes) {
      const gb = limitBytes / 1024 ** 3
      throw new ForbiddenException(
        `Storage full — the ${plan} plan allows ${gb}GB. Upgrade for more space.`,
      )
    }

    const result = await this.storage.upload({ buffer: optimized, ext, mime: file.mimetype }, safeFolder)
    await this.assets.save(
      this.assets.create({ userId, key: result.key, url: result.url, bytes, mime: file.mimetype, folder: safeFolder }),
    )
    return result
  }

  /** Current storage usage + the caller's plan limit. */
  async usage(userId: string): Promise<StorageUsage> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    const used = await this.assets.sum('bytes', { userId })
    return { plan: user.plan, usedBytes: Number(used ?? 0), limitBytes: storageLimitBytes(user.plan) }
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key)
    await this.assets.delete({ key })
  }

  /** Auto-orient + downscale + recompress. Animated GIFs pass through untouched. */
  private async optimize(buffer: Buffer, mime: string): Promise<Buffer> {
    if (mime === 'image/gif') return buffer // don't flatten animation
    try {
      const img = sharp(buffer).rotate().resize(MAX_EDGE, MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      // NOTE: await inside the try so an async decode rejection is caught here.
      if (mime === 'image/png') return await img.png({ compressionLevel: 9 }).toBuffer()
      if (mime === 'image/webp') return await img.webp({ quality: 82 }).toBuffer()
      return await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    } catch {
      // If sharp can't process it, store the original rather than fail the upload.
      return buffer
    }
  }
}
