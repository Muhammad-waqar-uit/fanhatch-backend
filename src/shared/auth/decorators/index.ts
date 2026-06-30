import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { IAuthUser } from '../../interfaces'

/** Marks a route as public — skips JwtAuthGuard when applied globally. */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/** Restricts a route to the given roles (used with RolesGuard). */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

/** Injects the authenticated user (or a single field via @CurrentUser('id')). */
export const CurrentUser = createParamDecorator(
  (field: keyof IAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user: IAuthUser = request.user
    return field ? user?.[field] : user
  },
)
