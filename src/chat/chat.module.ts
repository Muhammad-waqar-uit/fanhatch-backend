import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '@app/src/users/user.entity'
import { ChatRoom } from './entities/chat-room.entity'
import { RoomMember } from './entities/room-member.entity'
import { ChatMessage } from './entities/chat-message.entity'
import { Holding } from '../clubs/entities/holding.entity'
import { ChatController } from './chat.controller'
import { ChatGateway } from './chat.gateway'
import { RoomService } from './room.service'
import { MessageService } from './message.service'
import { MEMBERSHIP_SERVICE, Web2MembershipService } from './membership/membership.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, RoomMember, ChatMessage, User, Holding]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') as never },
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    RoomService,
    MessageService,
    ChatGateway,
    // WEB3 SEAM: swap Web2MembershipService → Web3GatedMembershipService here
    // to flip web2 → web3-gated access with no gateway/REST changes.
    { provide: MEMBERSHIP_SERVICE, useClass: Web2MembershipService },
  ],
  // RoomService is exported so ClubsModule can provision a club's chat room on create.
  exports: [RoomService],
})
export class ChatModule {}
