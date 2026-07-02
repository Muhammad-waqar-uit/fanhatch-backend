import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduledTask } from './entities/scheduled-task.entity'
import { TaskSchedulerService } from './task-scheduler.service'

/**
 * Durable task/transaction table + scheduler service. Imported by AppModule
 * only when Redis is configured (see the conditional spread in app.module.ts).
 * `ScheduleModule.forRoot()` is global, so the reconciler `@Cron` is picked up
 * without importing it here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ScheduledTask])],
  providers: [TaskSchedulerService],
  exports: [TaskSchedulerService],
})
export class TaskSchedulerModule {}
