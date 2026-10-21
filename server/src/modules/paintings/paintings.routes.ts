import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireRole } from '../../middleware/auth.js';
import { parse } from '../../lib/validate.js';
import { createPainting, getPainting, listPaintings, updatePainting } from './paintings.service.js';

// Image uploads are out of scope, so an image is a URL or a path served by this app.
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), 'Must be an http(s) URL or a path starting with /')
  .transform((v) => (v === '' ? null : v));

const paintingFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  artist: z.string().trim().min(1, 'Artist is required').max(100),
  description: z.string().trim().max(2000),
  price: z.number({ error: 'Price must be a number' }).int('Price must be a whole number').positive().max(10_000_000),
  imageUrl: imageUrl.nullable().optional(),
};

// strictObject: unknown keys such as "status" or "id" are rejected with 400.
const createSchema = z.strictObject(paintingFields);
const updateSchema = z
  .strictObject(paintingFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const paintingId = z.string().trim().min(1).max(50);

const listQuery = z.object({ status: z.enum(['available', 'sold']).optional() });

export function paintingRoutes(ctx: AppContext) {
  const router = Router();

  // Browsing is public: anyone can see the catalogue (see DESIGN.md).
  router.get('/', (req, res) => {
    const { status } = parse(listQuery, req.query);
    res.json({ paintings: listPaintings(ctx, status) });
  });

  router.get('/:id', (req, res) => {
    res.json({ painting: getPainting(ctx, parse(paintingId, req.params.id)) });
  });

  router.post('/', requireRole('studio'), (req, res) => {
    const input = parse(createSchema, req.body);
    res.status(201).json({ painting: createPainting(ctx, input) });
  });

  router.patch('/:id', requireRole('studio'), (req, res) => {
    const patch = parse(updateSchema, req.body);
    res.json({ painting: updatePainting(ctx, parse(paintingId, req.params.id), patch) });
  });

  return router;
}
