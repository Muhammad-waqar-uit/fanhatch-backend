import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { MediaController } from './media.controller'
import { MediaService } from './media.service'
import { MediaAsset } from './entities/media-asset.entity'
import { LocalDiskStorage } from './storage/local-disk.storage'
import { S3Storage } from './storage/s3.storage'
import { STORAGE_DRIVER } from './storage/storage.interface'

/**
 * Binds the active storage driver from `STORAGE_DRIVER` env (local | s3).
 * Defaults to local disk so dev needs no cloud credentials.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset, User])],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: STORAGE_DRIVER,
      useClass: process.env.STORAGE_DRIVER === 's3' ? S3Storage : LocalDiskStorage,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
