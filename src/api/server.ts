import express from 'express';
import type { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createChildLogger } from '../utils/logger.js';
import healthRouter from './routes/health.js';
import chatsRouter from './routes/chats.js';
import messagesRouter from './routes/messages.js';
import contactsRouter from './routes/contacts.js';
import searchRouter from './routes/search.js';

const apiLogger = createChildLogger('api');

export function createServer(): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      apiLogger.info({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  });

  // Mount routes
  app.use('/api/health', healthRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/search', searchRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    apiLogger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  return app;
}

export default createServer;
