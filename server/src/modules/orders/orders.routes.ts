import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { idParam, parse } from '../../lib/validate.js';
import { cancelOrder, getOrder, listOrders, placeOrder } from './orders.service.js';

// The only thing a customer chooses is WHICH painting. Price, owner and status
// are decided by the server; extra keys are rejected.
const placeSchema = z.strictObject({
  paintingId: z.string({ error: 'paintingId is required' }).trim().min(1, 'paintingId is required'),
});

export function orderRoutes(ctx: AppContext) {
  const router = Router();

  router.get('/', requireAuth, (req, res) => {
    res.json({ orders: listOrders(ctx, req.user!) });
  });

  router.get('/:id', requireAuth, (req, res) => {
    res.json({ order: getOrder(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  router.post('/', requireRole('customer'), (req, res) => {
    const { paintingId } = parse(placeSchema, req.body);
    res.status(201).json({ order: placeOrder(ctx, req.user!.id, paintingId) });
  });

  router.post('/:id/cancel', requireRole('customer'), (req, res) => {
    res.json({ order: cancelOrder(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  return router;
}
