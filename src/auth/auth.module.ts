import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtStrategy } from '@app/shared/auth'
import { UsersModule } from '@app/src/users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { Web3AuthTokenService } from './web3auth-token.service'

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') as never },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, Web3AuthTokenService],
})
export class AuthModule {}
