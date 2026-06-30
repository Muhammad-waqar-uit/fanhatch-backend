import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Authenticates if a valid token is present, but never rejects — `request.user`
 * is simply undefined for anonymous callers. Use on routes that vary by login
 * state (e.g. a feed that's richer when authenticated).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context)
  }

  // Swallow the error so anonymous requests pass through.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user || (undefined as TUser)
  }
}
