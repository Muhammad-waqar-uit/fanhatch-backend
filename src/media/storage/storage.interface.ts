/** Pluggable file storage — LocalDisk in dev, S3 in prod. Bound by STORAGE_DRIVER env. */

export interface UploadResult {
  /** Publicly reachable URL of the stored object. */
  url: string
  /** Storage key (path within the bucket / upload dir) — used for delete. */
  key: string
}

export interface StorageDriver {
  upload(file: { buffer: Buffer; ext: string; mime: string }, folder: string): Promise<UploadResult>
  delete(key: string): Promise<void>
}

/** DI token for the active storage driver. */
export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER')
