export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'jobs',
    password: process.env.DATABASE_PASSWORD ?? 'jobs',
    name: process.env.DATABASE_NAME ?? 'async_jobs',
    /** Dev-only: auto-create tables. Prefer `npm run db:migrate`. */
    sync: process.env.DB_SYNC ?? 'false',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  queue: {
    name: process.env.QUEUE_NAME ?? 'jobs',
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '5', 10),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    username: process.env.AUTH_USERNAME ?? 'admin',
    password: process.env.AUTH_PASSWORD ?? 'admin123',
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
  logging: {
    dir: process.env.LOG_DIR ?? 'logs',
  },
});
