export const APP_NAME = 'whatsapp-mail';

export const SERVICE_NAMES = {
  api: 'api',
  worker: 'worker',
  web: 'web',
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];
