import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { SearchService } from '../../services/search.service.js';

const router: RouterType = express.Router();

// GET / — full-text search
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = req.query.q ? String(req.query.q) : undefined;

    if (!q || q.trim().length === 0) {
      res.status(400).json({ error: 'Search query parameter "q" is required' });
      return;
    }

    const chatId = req.query.chatId ? parseInt(String(req.query.chatId), 10) : undefined;
    const messageType = req.query.messageType ? String(req.query.messageType) : undefined;
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const offset = (page - 1) * limit;

    const { results, total } = await SearchService.fullTextSearch(q, {
      chatId,
      messageType,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', message: String(error) });
  }
});

export default router;
