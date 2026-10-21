import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { dateString, idParam, parse } from '../../lib/validate.js';
import {
  BOOKING_RULES,
  cancelBooking,
  createBooking,
  decideBooking,
  getBooking,
  listBookings,
  unavailableDates,
} from './bookings.service.js';

// The client sends what the customer chose. Price, rate, status and owner are
// never accepted from the client; strictObject rejects them as unknown keys.
const createSchema = z.strictObject({
  date: dateString,
  wallSizeSqft: z
    .number({ error: 'Wall size must be a number' })
    .int('Wall size must be a whole number of square feet')
    .min(BOOKING_RULES.minWallSqft, `Wall size must be at least ${BOOKING_RULES.minWallSqft} sq ft`)
    .max(BOOKING_RULES.maxWallSqft, `Wall size must be at most ${BOOKING_RULES.maxWallSqft} sq ft`),
  address: z.string({ error: 'Address is required' }).trim().min(1, 'Address is required').max(500),
});

export function bookingRoutes(ctx: AppContext) {
  const router = Router();

  router.get('/', requireAuth, (req, res) => {
    res.json({ bookings: listBookings(ctx, req.user!) });
  });

  // Declared before '/:id' so "unavailable-dates" is not treated as an id.
  router.get('/unavailable-dates', requireAuth, (_req, res) => {
    res.json({ dates: unavailableDates(ctx) });
  });

  router.get('/:id', requireAuth, (req, res) => {
    res.json({ booking: getBooking(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  router.post('/', requireRole('customer'), (req, res) => {
    const input = parse(createSchema, req.body);
    res.status(201).json({ booking: createBooking(ctx, req.user!.id, input) });
  });

  router.post('/:id/cancel', requireRole('customer'), (req, res) => {
    res.json({ booking: cancelBooking(ctx, req.user!, parse(idParam, req.params.id)) });
  });

  router.post('/:id/confirm', requireRole('studio'), (req, res) => {
    res.json({ booking: decideBooking(ctx, parse(idParam, req.params.id), 'confirmed') });
  });

  router.post('/:id/decline', requireRole('studio'), (req, res) => {
    res.json({ booking: decideBooking(ctx, parse(idParam, req.params.id), 'declined') });
  });

  return router;
}
