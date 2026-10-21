import type { AppContext, Viewer } from '../../context.js';
import { isUniqueViolation } from '../../db/database.js';
import { conflict, notFound } from '../../lib/errors.js';

export interface Order {
  id: number;
  paintingId: string;
  paintingTitle: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  price: number;
  status: 'placed' | 'cancelled';
  createdAt: string;
  cancelledAt: string | null;
}

const SELECT_ORDER = `
  SELECT o.id, o.painting_id AS paintingId, p.title AS paintingTitle,
         o.customer_id AS customerId, u.name AS customerName, u.email AS customerEmail,
         o.price, o.status, o.created_at AS createdAt, o.cancelled_at AS cancelledAt
  FROM orders o
  JOIN paintings p ON p.id = o.painting_id
  JOIN users u ON u.id = o.customer_id`;

const PAINTING_SOLD = 'This painting has already been sold.';

/** Customers see only their own orders; the studio sees all. */
export function listOrders(ctx: AppContext, user: Viewer): Order[] {
  if (user.role === 'studio') {
    return ctx.db.prepare(`${SELECT_ORDER} ORDER BY o.id DESC`).all() as Order[];
  }
  return ctx.db.prepare(`${SELECT_ORDER} WHERE o.customer_id = ? ORDER BY o.id DESC`).all(user.id) as Order[];
}

/** A customer asking for someone else's order gets 404, exactly like a missing one. */
export function getOrder(ctx: AppContext, user: Viewer, id: number): Order {
  const order = (
    user.role === 'studio'
      ? ctx.db.prepare(`${SELECT_ORDER} WHERE o.id = ?`).get(id)
      : ctx.db.prepare(`${SELECT_ORDER} WHERE o.id = ? AND o.customer_id = ?`).get(id, user.id)
  ) as Order | undefined;
  if (!order) throw notFound('Order');
  return order;
}

/**
 * Buys a painting. Two layers stop a double sale:
 *  1. Inside one transaction, the painting is flipped to 'sold' only
 *     WHERE status = 'available'. If another purchase already flipped it,
 *     zero rows change and we answer 409.
 *  2. The partial unique index orders_one_placed_per_painting makes a second
 *     'placed' order for the same painting impossible at the database level.
 */
export function placeOrder(ctx: AppContext, customerId: number, paintingId: string): Order {
  const now = ctx.clock().toISOString();
  try {
    const orderId = ctx.db.transaction(() => {
      const claimed = ctx.db
        .prepare(`UPDATE paintings SET status = 'sold', updated_at = ? WHERE id = ? AND status = 'available'`)
        .run(now, paintingId);
      if (claimed.changes === 0) {
        const exists = ctx.db.prepare('SELECT 1 FROM paintings WHERE id = ?').get(paintingId);
        if (!exists) throw notFound('Painting');
        throw conflict('PAINTING_SOLD', PAINTING_SOLD);
      }
      // Price comes from the database, never from the request body.
      const { price } = ctx.db.prepare('SELECT price FROM paintings WHERE id = ?').get(paintingId) as {
        price: number;
      };
      const result = ctx.db
        .prepare(`INSERT INTO orders (painting_id, customer_id, price, status, created_at) VALUES (?, ?, ?, 'placed', ?)`)
        .run(paintingId, customerId, price, now);
      return Number(result.lastInsertRowid);
    })();
    return getOrder(ctx, { id: customerId, role: 'customer' }, orderId);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('PAINTING_SOLD', PAINTING_SOLD);
    throw err;
  }
}

/** Cancels the customer's own placed order and puts the painting back on sale, atomically. */
export function cancelOrder(ctx: AppContext, customer: Viewer, orderId: number): Order {
  const now = ctx.clock().toISOString();
  ctx.db.transaction(() => {
    const order = getOrder(ctx, customer, orderId); // 404 if not theirs
    const result = ctx.db
      .prepare(`UPDATE orders SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'placed'`)
      .run(now, order.id);
    if (result.changes === 0) {
      throw conflict('ORDER_NOT_CANCELLABLE', 'This order has already been cancelled.');
    }
    ctx.db
      .prepare(`UPDATE paintings SET status = 'available', updated_at = ? WHERE id = ?`)
      .run(now, order.paintingId);
  })();
  return getOrder(ctx, customer, orderId);
}
