/**
 * Nest ConfigModule can plug a Joi/Zod schema here.
 * Keep required keys documented next to .env.example.
 */
export const REQUIRED_ENV_KEYS = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'REDIS_HOST',
  'REDIS_PORT',
] as const;
