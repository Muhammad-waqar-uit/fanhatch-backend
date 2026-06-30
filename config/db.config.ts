export default () => ({
  db: {
    type: 'postgres',
    host: process.env.TYPEORM_DB_HOST || 'localhost',
    port: parseInt(process.env.TYPEORM_PORT || '5432', 10),
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || 'postgres',
    database: process.env.TYPEORM_DATABASE || 'fanstech',
    // Entities are auto-loaded by @nestjs/typeorm (autoLoadEntities); migrations run via the CLI.
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
    ssl: process.env.TYPEORM_SSL === 'true',
  },
})
