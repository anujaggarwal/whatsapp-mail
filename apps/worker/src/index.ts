import dotenv from 'dotenv';
import { SERVICE_NAMES, createLogger, loadEnv } from '@wm/shared';

dotenv.config();

const env = loadEnv();
const logger = createLogger({ service: SERVICE_NAMES.worker, level: env.logLevel });

logger.info(
  {
    nodeEnv: env.nodeEnv,
    whatsappSessionDir: env.whatsappSessionDir,
  },
  'Worker service bootstrap complete'
);
