import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { dateString, idParam, parse } from '../../lib/validate.js';
import {
  POTTERY_RULES,
  cancelRequest,
  createRequest,
  decideRequest,
  getRequest,
  listOptions,
  listRequests,
  updateRequest,
} from './pottery.service.js';

// Shape checks happen here; checks that need the database (does this item
// exist?) or today's date happen in the service.
const fields = {
  itemId: z.string({ error: 'Pottery item is required' }).trim().min(1, 'Pottery item is required'),
  glazeId: z.string({ error: 'Glaze is required' }).trim().min(1, 'Glaze is required'),
  quantity: z
    .number({ error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(POTTERY_RULES.minQuantity, `Quantity must be at least ${POTTERY_RULES.minQuantity}`)
    .max(POTTERY_RULES.maxQuantity, `Quantity must be at most ${POTTERY_RULES.maxQuantity}`),
  neededBy: dateString,
};

const createSchema = z.strictObject(fields);
const updateSchema = z
  .strictObject(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export function potteryOptionRoutes(ctx: AppContext) {
  const router = Router();
  router.get('/', (_req, res) => res.json(listOptions(ctx)));
  return router;
}

export function potteryRequestRoutes(ctx: AppContext) {
  const router = Router();

  router.get('/', requireAuth, (req, res) => {
    res.json({ requests: listRequests(ctx, req.user!) });
  });

  router.get('/:id', requireAuth, (req, res) => {
    res.json({ request: getRequest(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  router.post('/', requireRole('customer'), (req, res) => {
    const input = parse(createSchema, req.body);
    res.status(201).json({ request: createRequest(ctx, req.user!.id, input) });
  });

  router.patch('/:id', requireRole('customer'), (req, res) => {
    const id = parse(idParam, req.params.id);
    const patch = parse(updateSchema, req.body);
    res.json({ request: updateRequest(ctx, req.user!, id, patch) });
  });

  router.post('/:id/cancel', requireRole('customer'), (req, res) => {
    res.json({ request: cancelRequest(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  router.post('/:id/accept', requireRole('studio'), (req, res) => {
    res.json({ request: decideRequest(ctx, parse(idParam, req.params.id), 'accepted') });
  });

  router.post('/:id/decline', requireRole('studio'), (req, res) => {
    res.json({ request: decideRequest(ctx, parse(idParam, req.params.id), 'declined') });
  });

  return router;
}
