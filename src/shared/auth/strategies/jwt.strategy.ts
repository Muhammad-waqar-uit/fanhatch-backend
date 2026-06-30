import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { IAuthUser, IJwtPayload } from '../../interfaces'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    })
  }

  /** Return value is attached to `request.user`. */
  async validate(payload: IJwtPayload): Promise<IAuthUser> {
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
}
