import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IAuthUser } from '../../interfaces'
import { ROLES_KEY } from '../decorators'

/** Enforces @Roles(...) — use after JwtAuthGuard so request.user is populated. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const user: IAuthUser = context.switchToHttp().getRequest().user
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role')
    }
    return true
  }
}
