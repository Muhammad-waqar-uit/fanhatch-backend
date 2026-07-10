import 'dotenv/config'
import { DataSource } from 'typeorm'

/**
 * Standalone TypeORM DataSource for the CLI (migrations).
 *
 * The NestJS app builds its connection from `config/db.config.ts` via
 * `@nestjs/config`, but the TypeORM 0.3 CLI needs a concrete `DataSource`
 * passed with `-d`. Entities + migrations resolve to the COMPILED `dist`
 * output (the migration scripts run `npm run build` first).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_DB_HOST || 'localhost',
  port: parseInt(process.env.TYPEORM_PORT || '5432', 10),
  username: process.env.TYPEORM_USERNAME || 'postgres',
  password: process.env.TYPEORM_PASSWORD || 'postgres',
  database: process.env.TYPEORM_DATABASE || 'fanhatch',
  entities: ['dist/src/**/*.entity.js'],
  migrations: ['dist/src/migrations/*.js'],
  migrationsTableName: process.env.TYPEORM_MIGRATIONS_TABLE_NAME || 'migrations',
  synchronize: false,
  logging: false,
  ssl: process.env.TYPEORM_SSL === 'true' ? { rejectUnauthorized: false } : false,
})
