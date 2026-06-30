import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { IJwtPayload } from '@app/shared/interfaces'
import { User } from '@app/src/users/user.entity'
import { UsersService } from '@app/src/users/users.service'
import { LoginDto, RegisterDto } from './dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.users.createWithPassword(dto)
    return this.issue(user)
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithSecret(dto.email)
    if (!user || !(await this.users.verifyPassword(user, dto.password))) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return this.issue(user)
  }

  private issue(user: User) {
    const payload: IJwtPayload = { sub: user.id, email: user.email, role: user.role }
    return {
      accessToken: this.jwt.sign(payload),
      user: user.toResponseObject(),
    }
  }
}
