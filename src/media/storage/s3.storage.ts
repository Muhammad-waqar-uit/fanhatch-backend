import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import type { StorageDriver, UploadResult } from './storage.interface'

/**
 * Prod driver: PutObject to S3_BUCKET, returns `${PUBLIC_S3_BASE_URL}/<key>`.
 * Only instantiated when STORAGE_DRIVER=s3; reads AWS creds from the standard env.
 */
@Injectable()
export class S3Storage implements StorageDriver {
  private readonly logger = new Logger(S3Storage.name)
  private readonly bucket = process.env.S3_BUCKET ?? ''
  private readonly base = (process.env.PUBLIC_S3_BASE_URL ?? '').replace(/\/$/, '')
  private readonly client = new S3Client({ region: process.env.S3_REGION ?? 'us-east-1' })

  async upload(file: { buffer: Buffer; ext: string; mime: string }, folder: string): Promise<UploadResult> {
    const key = `${folder}/${randomUUID()}.${file.ext}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return { url: `${this.base}/${key}`, key }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (err) {
      this.logger.warn(`delete(${key}) failed: ${(err as Error).message}`)
    }
  }
}
