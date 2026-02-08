import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { Message, Chat, MessageMedia } from '../../models/index.js';

const router: RouterType = express.Router();

// GET /:id — get single message by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const message = await Message.findByPk(id, {
      include: [
        {
          model: Chat,
          as: 'chat',
        },
        {
          model: Message,
          as: 'quotedMessage',
          required: false,
        },
      ],
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.json({ data: message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch message', message: String(error) });
  }
});

// GET /:id/media — get media for a message
router.get('/:id/media', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const media = await MessageMedia.findAll({
      where: { message_id: id },
    });

    res.json({ data: media });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media', message: String(error) });
  }
});

export default router;
