import type { AppContext, Viewer } from '../../context.js';
import { isUniqueViolation } from '../../db/database.js';
import { daysBetween, todayIn } from '../../lib/dates.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getMuralRate } from '../studio/settings.service.js';

export const BOOKING_RULES = {
  minDaysAhead: 7,
  maxDaysAhead: 90,
  minWallSqft: 10,
  maxWallSqft: 500,
  /** Customers may cancel while the booking is at least this many days away. */
  cancelUntilDaysBefore: 3,
} as const;

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled';

export interface Booking {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  date: string;
  wallSizeSqft: number;
  address: string;
  ratePerSqft: number;
  price: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

const SELECT_BOOKING = `
  SELECT b.id, b.customer_id AS customerId, u.name AS customerName, u.email AS customerEmail,
         b.booking_date AS date, b.wall_size_sqft AS wallSizeSqft, b.address,
         b.rate_per_sqft AS ratePerSqft, b.price, b.status,
         b.created_at AS createdAt, b.updated_at AS updatedAt
  FROM wall_bookings b JOIN users u ON u.id = b.customer_id`;

const today = (ctx: AppContext) => todayIn(ctx.config.studioTimezone, ctx.clock());

export function listBookings(ctx: AppContext, user: Viewer): Booking[] {
  if (user.role === 'studio') {
    return ctx.db.prepare(`${SELECT_BOOKING} ORDER BY b.booking_date`).all() as Booking[];
  }
  return ctx.db
    .prepare(`${SELECT_BOOKING} WHERE b.customer_id = ? ORDER BY b.booking_date`)
    .all(user.id) as Booking[];
}

/** 404 for a missing booking AND for another customer's booking. */
export function getBooking(ctx: AppContext, user: Viewer, id: number): Booking {
  const booking = (
    user.role === 'studio'
      ? ctx.db.prepare(`${SELECT_BOOKING} WHERE b.id = ?`).get(id)
      : ctx.db.prepare(`${SELECT_BOOKING} WHERE b.id = ? AND b.customer_id = ?`).get(id, user.id)
  ) as Booking | undefined;
  if (!booking) throw notFound('Booking');
  return booking;
}

/** Upcoming dates already held by a requested or confirmed booking (no customer details). */
export function unavailableDates(ctx: AppContext): string[] {
  const rows = ctx.db
    .prepare(
      `SELECT booking_date AS date FROM wall_bookings
       WHERE status IN ('requested', 'confirmed') AND booking_date >= ? ORDER BY booking_date`,
    )
    .all(today(ctx)) as { date: string }[];
  return rows.map((r) => r.date);
}

export function createBooking(
  ctx: AppContext,
  customerId: number,
  input: { date: string; wallSizeSqft: number; address: string },
): Booking {
  const { minDaysAhead, maxDaysAhead } = BOOKING_RULES;
  const daysAway = daysBetween(today(ctx), input.date);
  if (daysAway < minDaysAhead || daysAway > maxDaysAhead) {
    throw badRequest(`Booking date must be between ${minDaysAhead} and ${maxDaysAhead} days from today.`, [
      { field: 'date', message: `Must be ${minDaysAhead}–${maxDaysAhead} days from today (it is ${daysAway}).` },
    ]);
  }

  // Price = size × rate, using the rate stored in the database. The rate is
  // saved on the booking so later rate changes don't alter existing bookings.
  const rate = getMuralRate(ctx);
  const price = input.wallSizeSqft * rate;
  const now = ctx.clock().toISOString();

  try {
    // No "is the date free?" SELECT first: that would leave a gap between check
    // and insert. Instead we just insert, and the partial unique index
    // wall_bookings_one_active_per_date rejects a second active booking.
    const result = ctx.db
      .prepare(
        `INSERT INTO wall_bookings
           (customer_id, booking_date, wall_size_sqft, address, rate_per_sqft, price, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
      )
      .run(customerId, input.date, input.wallSizeSqft, input.address, rate, price, now, now);
    return getBooking(ctx, { id: customerId, role: 'customer' }, Number(result.lastInsertRowid));
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict('DATE_TAKEN', `${input.date} is no longer available. Please choose another date.`);
    }
    throw err;
  }
}

export function cancelBooking(ctx: AppContext, customer: Viewer, id: number): Booking {
  ctx.db.transaction(() => {
    const booking = getBooking(ctx, customer, id);
    if (booking.status !== 'requested' && booking.status !== 'confirmed') {
      throw conflict('BOOKING_NOT_CANCELLABLE', `This booking is already ${booking.status} and cannot be cancelled.`);
    }
    if (daysBetween(today(ctx), booking.date) < BOOKING_RULES.cancelUntilDaysBefore) {
      throw conflict(
        'CANCELLATION_WINDOW_CLOSED',
        'You cannot cancel this booking within three days of its date.',
      );
    }
    ctx.db
      .prepare(
        `UPDATE wall_bookings SET status = 'cancelled', updated_at = ?
         WHERE id = ? AND status IN ('requested', 'confirmed')`,
      )
      .run(ctx.clock().toISOString(), id);
  })();
  return getBooking(ctx, customer, id);
}

/** Studio decision. Only a 'requested' booking can be confirmed or declined. */
export function decideBooking(ctx: AppContext, id: number, decision: 'confirmed' | 'declined'): Booking {
  const result = ctx.db
    .prepare(`UPDATE wall_bookings SET status = ?, updated_at = ? WHERE id = ? AND status = 'requested'`)
    .run(decision, ctx.clock().toISOString(), id);
  const studio: Viewer = { id: 0, role: 'studio' };
  if (result.changes === 0) {
    const booking = getBooking(ctx, studio, id); // 404 if missing
    throw conflict(
      'BOOKING_NOT_PENDING',
      `Only requested bookings can be confirmed or declined. This booking is ${booking.status}.`,
    );
  }
  return getBooking(ctx, studio, id);
}
