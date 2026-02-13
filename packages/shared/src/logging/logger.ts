import pino, { type Logger } from 'pino';
import type { ServiceName } from '../constants/app.js';

interface LoggerOptions {
  service: ServiceName;
  level: string;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    name: options.service,
    level: options.level,
    base: {
      service: options.service,
    },
  });
}
