import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

// ---- Request DTOs --------------------------------------------------------

export class CreateRoomDto {
  @ApiProperty({ enum: ['club', 'group'] })
  @IsIn(['club', 'group'])
  type: 'club' | 'group'

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clubId?: string
}

export class CreateDmDto {
  @ApiProperty({ description: 'The other participant of the 1:1 DM.' })
  @IsUUID()
  peerUserId: string
}

export class SendMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  body: string

  @ApiPropertyOptional({ enum: ['text', 'image', 'gif'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'image', 'gif'])
  type?: 'text' | 'image' | 'gif'
}

export class QueryMessagesDto {
  @ApiPropertyOptional({ description: 'ISO timestamp; returns messages older than this.' })
  @IsOptional()
  @IsString()
  cursor?: string

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30
}

// ---- Response DTO shapes (match the realtime contract exactly) -----------

export type RoomType = 'club' | 'dm' | 'group'
export type MessageType = 'text' | 'image' | 'gif'

export class LastMessageDto {
  @ApiProperty() body: string
  @ApiProperty({ description: 'ISO timestamp' }) sentAt: string
}

export class ChatRoomDto {
  @ApiProperty() id: string
  @ApiProperty({ enum: ['club', 'dm', 'group'] }) type: RoomType
  @ApiProperty() name: string
  @ApiPropertyOptional() avatarUrl?: string
  @ApiPropertyOptional({ description: 'Set for club rooms (future gating key).' }) clubId?: string
  @ApiProperty() memberCount: number
  @ApiPropertyOptional({ type: LastMessageDto }) lastMessage?: LastMessageDto
  @ApiPropertyOptional() unread?: number
}

export class ChatMessageDto {
  @ApiProperty() id: string
  @ApiProperty() roomId: string
  @ApiProperty() senderId: string
  @ApiProperty() senderName: string
  @ApiPropertyOptional() senderAvatarUrl?: string
  @ApiProperty({ enum: ['text', 'image', 'gif'] }) type: MessageType
  @ApiProperty() body: string
  @ApiProperty({ description: 'ISO timestamp' }) sentAt: string
}

export class MessageHistoryDto {
  @ApiProperty({ type: [ChatMessageDto] }) items: ChatMessageDto[]
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null
}
