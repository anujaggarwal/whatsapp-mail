import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { sequelize } from '../../models/index.js';

const router: RouterType = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  let databaseStatus = 'disconnected';

  try {
    await sequelize.authenticate();
    databaseStatus = 'connected';
  } catch {
    databaseStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: databaseStatus,
    version: '1.0.0',
  });
});

export default router;
