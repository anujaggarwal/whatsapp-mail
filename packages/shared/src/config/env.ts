import { DEFAULTS, ENV_KEYS } from '../constants/env.js';

export interface AppEnv {
  nodeEnv: string;
  logLevel: string;
  apiPort: number;
  databaseUrl?: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword?: string;
  whatsappSessionDir: string;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: source[ENV_KEYS.NODE_ENV] || DEFAULTS.NODE_ENV,
    logLevel: source[ENV_KEYS.LOG_LEVEL] || DEFAULTS.LOG_LEVEL,
    apiPort: parseNumber(source[ENV_KEYS.API_PORT], DEFAULTS.API_PORT),
    databaseUrl: source[ENV_KEYS.DATABASE_URL],
    dbHost: source[ENV_KEYS.DB_HOST] || DEFAULTS.DB_HOST,
    dbPort: parseNumber(source[ENV_KEYS.DB_PORT], DEFAULTS.DB_PORT),
    dbName: source[ENV_KEYS.DB_NAME] || DEFAULTS.DB_NAME,
    dbUser: source[ENV_KEYS.DB_USER] || DEFAULTS.DB_USER,
    dbPassword: source[ENV_KEYS.DB_PASSWORD],
    whatsappSessionDir: source[ENV_KEYS.WHATSAPP_SESSION_DIR] || DEFAULTS.WHATSAPP_SESSION_DIR,
  };
}
