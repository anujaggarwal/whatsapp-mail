import dotenv from 'dotenv';
import express from 'express';
import { SERVICE_NAMES, createLogger, loadEnv } from '@wm/shared';

dotenv.config();

const env = loadEnv();
const logger = createLogger({ service: SERVICE_NAMES.api, level: env.logLevel });

const app = express();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: SERVICE_NAMES.api,
    env: env.nodeEnv,
  });
});

app.listen(env.apiPort, () => {
  logger.info({ port: env.apiPort }, 'API service started');
});
