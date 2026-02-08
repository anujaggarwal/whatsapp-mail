import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { Op } from 'sequelize';
import { Chat, Message, GroupMetadata, GroupParticipant } from '../../models/index.js';

const router: RouterType = express.Router();

// GET / — list chats
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const archived = req.query.archived === 'true';
    const search = req.query.search ? String(req.query.search) : undefined;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      is_archived: archived,
    };

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { rows: data, count: total } = await Chat.findAndCountAll({
      where,
      order: [
        ['is_pinned', 'DESC'],
        ['last_message_at', 'DESC NULLS LAST'],
      ],
      limit,
      offset,
    });

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats', message: String(error) });
  }
});

// GET /:id — get single chat by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chat = await Chat.findByPk(id, {
      include: [
        {
          model: GroupMetadata,
          as: 'groupMetadata',
          include: [
            {
              model: GroupParticipant,
              as: 'participants',
            },
          ],
        },
      ],
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    res.json({ data: chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat', message: String(error) });
  }
});

// GET /:id/messages — get messages for a chat
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chatId = parseInt(idParam, 10);
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 100));
    const before = req.query.before ? String(req.query.before) : undefined;
    const after = req.query.after ? String(req.query.after) : undefined;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {
      chat_id: chatId,
      is_deleted: false,
    };

    if (before) {
      where.timestamp = { ...((where.timestamp as Record<string, unknown>) || {}), [Op.lt]: new Date(before) };
    }

    if (after) {
      where.timestamp = { ...((where.timestamp as Record<string, unknown>) || {}), [Op.gt]: new Date(after) };
    }

    const { rows: data, count: total } = await Message.findAndCountAll({
      where,
      order: [['timestamp', 'ASC']],
      limit,
      offset,
      include: [
        {
          model: Message,
          as: 'quotedMessage',
          required: false,
        },
      ],
    });

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages', message: String(error) });
  }
});

export default router;
