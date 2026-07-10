export default () => ({
  db: {
    type: 'postgres',
    host: process.env.TYPEORM_DB_HOST || 'localhost',
    port: parseInt(process.env.TYPEORM_PORT || '5432', 10),
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || 'postgres',
    database: process.env.TYPEORM_DATABASE || 'fanhatch',
    // Entities are auto-loaded by @nestjs/typeorm (autoLoadEntities); migrations run via the CLI.
    // DEV ONLY: set TYPEORM_SYNC=true to auto-create the schema from entities (no migrations needed
    // for a quick local test). Keep false in prod and use migrations. ponytail: a proper `users`
    // baseline migration is still TODO — until then, dev relies on sync.
    synchronize: process.env.TYPEORM_SYNC === 'true',
    logging: process.env.TYPEORM_LOGGING === 'true',
    ssl: process.env.TYPEORM_SSL === 'true',
  },
})
