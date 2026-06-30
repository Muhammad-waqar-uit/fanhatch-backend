export interface ICorsConfig {
  origin: string[] | string
  methods: string
  credentials: boolean
}

/** Decoded JWT payload carried on every authenticated request. */
export interface IJwtPayload {
  sub: string // user id
  email?: string
  role?: string
}

/** The user object attached to `request.user` after JwtStrategy validation. */
export interface IAuthUser {
  id: string
  email?: string
  role?: string
}
