import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { Op } from 'sequelize';
import { Contact } from '../../models/index.js';

const router: RouterType = express.Router();

// GET / — list contacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const search = req.query.search ? String(req.query.search) : undefined;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone_number: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows: data, count: total } = await Contact.findAndCountAll({
      where,
      order: [['name', 'ASC']],
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
    res.status(500).json({ error: 'Failed to fetch contacts', message: String(error) });
  }
});

// GET /:id — get single contact
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const contact = await Contact.findByPk(id);

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json({ data: contact });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact', message: String(error) });
  }
});

export default router;
