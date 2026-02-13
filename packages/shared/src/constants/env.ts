export const ENV_KEYS = {
  NODE_ENV: 'NODE_ENV',
  LOG_LEVEL: 'LOG_LEVEL',
  API_PORT: 'API_PORT',
  DATABASE_URL: 'DATABASE_URL',
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_NAME: 'DB_NAME',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  WHATSAPP_SESSION_DIR: 'WHATSAPP_SESSION_DIR',
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export const DEFAULTS = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  API_PORT: 3001,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_NAME: 'whatsapp_logger',
  DB_USER: 'postgres',
  WHATSAPP_SESSION_DIR: './auth_info',
} as const;
