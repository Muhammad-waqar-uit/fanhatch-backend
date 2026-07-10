import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import type { StorageDriver, UploadResult } from './storage.interface'

/**
 * Dev default: writes to `UPLOAD_DIR` (./uploads) and serves the files statically
 * at `${APP_URL}/uploads/...` (see ServeStaticModule in app.module). No cloud creds.
 */
@Injectable()
export class LocalDiskStorage implements StorageDriver {
  private readonly logger = new Logger(LocalDiskStorage.name)
  private readonly root = process.env.UPLOAD_DIR ?? './uploads'
  private readonly baseUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  async upload(file: { buffer: Buffer; ext: string }, folder: string): Promise<UploadResult> {
    const key = `${folder}/${randomUUID()}.${file.ext}`
    const dest = join(this.root, key)
    await mkdir(join(this.root, folder), { recursive: true })
    await writeFile(dest, file.buffer)
    return { url: `${this.baseUrl}/uploads/${key}`, key }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.root, key))
    } catch (err) {
      // Non-fatal: a missing file is already "deleted".
      this.logger.warn(`delete(${key}) failed: ${(err as Error).message}`)
    }
  }
}
