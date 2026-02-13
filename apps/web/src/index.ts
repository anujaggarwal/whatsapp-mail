import dotenv from 'dotenv';
import { SERVICE_NAMES, createLogger, loadEnv } from '@wm/shared';

dotenv.config();

const env = loadEnv();
const logger = createLogger({ service: SERVICE_NAMES.web, level: env.logLevel });

logger.info(
  {
    nodeEnv: env.nodeEnv,
  },
  'Web service scaffold ready. Next.js migration is pending.'
);
