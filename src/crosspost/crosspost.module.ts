import { Module } from '@nestjs/common'
import { CrossPostService } from './crosspost.service'

@Module({
  providers: [CrossPostService],
  exports: [CrossPostService],
})
export class CrossPostModule {}
