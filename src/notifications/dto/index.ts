import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import {
  NotificationType,
  NotificationStatus,
  NotificationRelatedTo,
  NotificationSettingType,
} from '../enums'

/**
 * Query for `GET /notifications`. `relatedTo` accepts repeated `relatedTo[]=`
 * params (or a single value, normalized to an array); `read` filters by read
 * state (true → READ, false → UNREAD, omitted → both, excluding DELETED).
 */
export class QueryNotificationsDto {
  @ApiPropertyOptional({ enum: NotificationRelatedTo, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(NotificationRelatedTo, { each: true })
  relatedTo?: NotificationRelatedTo[]

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1

  @ApiPropertyOptional({ default: 15, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 15

  @ApiPropertyOptional({ description: 'true → read only, false → unread only' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    return undefined
  })
  @IsBoolean()
  read?: boolean
}

/** Body for `PATCH /notifications/settings`. */
export class ChangeSettingDto {
  @ApiProperty({ enum: NotificationSettingType })
  @IsEnum(NotificationSettingType)
  type: NotificationSettingType

  @ApiProperty()
  @IsBoolean()
  status: boolean
}

/**
 * Internal dispatch payload for `NotificationsService.create` (never bound from
 * an HTTP body — the recipient `userId` is supplied by the triggering service).
 */
export interface CreateNotificationPayload {
  userId: string
  type: NotificationType
  relatedTo: NotificationRelatedTo
  title: string
  body?: string
  data?: Record<string, unknown>
}

/** Fan-out payload for `notifyMany` — same as create minus the recipient. */
export type NotifyManyPayload = Omit<CreateNotificationPayload, 'userId'>

/** Response shape for a single notification (list item + detail). */
export class NotificationDto {
  @ApiProperty() id: string
  @ApiProperty({ enum: NotificationType }) type: NotificationType
  @ApiProperty({ enum: NotificationRelatedTo }) relatedTo: NotificationRelatedTo
  @ApiProperty({ enum: NotificationStatus }) status: NotificationStatus
  @ApiProperty() title: string
  @ApiPropertyOptional() body?: string
  @ApiProperty() data: Record<string, unknown>
  @ApiProperty() createdAt: Date
  @ApiPropertyOptional() readAt?: Date | null
}

/** Envelope for `GET /notifications` (contract-specified meta keys). */
export class NotificationListRO {
  @ApiProperty({ type: [NotificationDto] }) data: NotificationDto[]
  @ApiProperty() meta: {
    total_page: number
    current_page: number
    limit: number
    total_record: number
  }
}
