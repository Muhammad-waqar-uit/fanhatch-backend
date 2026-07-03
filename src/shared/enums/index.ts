export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum OrderDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  // Reserved for a future platform owner. No admin controls/endpoints exist yet —
  // this only makes the type available so a superadmin can be provisioned later.
  SUPERADMIN = 'superadmin',
}

/** i18n / error message keys. Extend as modules are added. */
export enum ErrorKey {
  NOT_FOUND = 'errors.not_found',
  ALREADY_EXISTS = 'errors.already_exists',
  UNAUTHORIZED = 'errors.unauthorized',
  INVALID_CREDENTIALS = 'errors.invalid_credentials',
}
