import { Column, Entity, Index } from 'typeorm'
import { MyEntity } from '@app/shared/base'

/** One uploaded file — used to sum per-user storage usage for plan quotas. */
@Entity('media_assets')
export class MediaAsset extends MyEntity {
  @Index()
  @Column('uuid')
  userId: string

  /** Storage key (path in the upload dir / S3 bucket). */
  @Column()
  key: string

  @Column()
  url: string

  /** Stored (post-optimization) size in bytes. */
  @Column({ type: 'bigint' })
  bytes: number

  @Column()
  mime: string

  @Column()
  folder: string
}
