# Fans.tech Backend

Web2 base structure (NestJS 11 + TypeORM + Postgres), mirroring the `mvmnt-backend`
conventions. This is the **foundation only** — auth, users, health, and the shared
layer — so feature modules (Home, LP, Chat, Wallet, …) can be dropped in and replicated
with a consistent pattern. Web3/indexer/solana concerns are intentionally left out for now.

## Stack

NestJS · TypeORM (Postgres) · JWT (passport-jwt) · class-validator · Swagger · Terminus health · Throttler.

## Quick start

```bash
cp .env.example .env
docker compose -f docker-compose.local.yaml up -d   # local Postgres
npm install
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health: `GET /api/v1/health`

## Layout

```
config/                 config factories (root, db, jwt, cors, swagger) loaded by ConfigModule
data-source.ts          standalone TypeORM DataSource for the migration CLI
src/
  main.ts               bootstrap: helmet, compression, validation, global filter/interceptor, swagger
  app.module.ts         ConfigModule + TypeOrm + Throttler + feature modules
  shared/               cross-cutting building blocks
    base/               MyEntity (uuid+timestamps), MyService (CRUD + pagination)
    dto/                PaginateDto, SuccessRO, PaginateRO
    enums/              Status, OrderDirection, UserRole, ErrorKey
    auth/               JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, @CurrentUser/@Public/@Roles
    filters/            HttpExceptionFilter (consistent error envelope)
    interceptors/       TransformInterceptor (consistent success envelope)
    middleware/         RawBodyMiddleware (webhook signature support)
    interfaces/         ICorsConfig, IJwtPayload, IAuthUser
    swagger/            setupSwagger()
  health/               liveness + DB/memory checks (Terminus)
  users/                example CRUD module — the template to copy
  auth/                 email+password → JWT (register / login / me)
```

## Adding a module (the pattern)

A module is a folder under `src/<name>/` with:

```
<name>.module.ts        @Module, imports TypeOrmModule.forFeature([Entity]), exports the service
<name>.controller.ts    @Controller, thin — delegates to the service
<name>.service.ts       extends MyService<Entity> for free CRUD + pagination
<name>.entity.ts        extends MyEntity (uuid id, created, updated)
dto/index.ts            Create / Update / Query DTOs (class-validator + @ApiProperty)
```

1. Scaffold the folder (copy `src/users/` as a starting point).
2. Register the module in `src/app.module.ts` `imports`.
3. Generate a migration: `npm run migration:generate -- src/migrations/AddX` then `npm run migration:run`.

Auth: routes are protected with `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`; mark open
routes with `@Public()`; read the caller with `@CurrentUser()` / `@CurrentUser('id')`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | watch-mode dev server |
| `npm run build` | compile to `dist/` |
| `npm run start:prod` | run compiled (`node dist/src/main`) |
| `npm run migration:generate -- src/migrations/Name` | generate a migration from entity diff |
| `npm run migration:run` / `migration:down` | apply / revert migrations |
| `npm run lint` / `npm run format` | eslint / prettier |

Set `TYPEORM_MIGRATIONS_RUN=true` to auto-run pending migrations on boot.
