import type { AppContext, Viewer } from '../../context.js';
import { daysBetween, todayIn } from '../../lib/dates.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

export const POTTERY_RULES = {
  minQuantity: 1,
  maxQuantity: 12,
  /** needed-by must be at least this many days from today */
  minDaysAhead: 14,
} as const;

export type PotteryStatus = 'requested' | 'accepted' | 'declined' | 'cancelled';

export interface PotteryRequest {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  itemId: string;
  itemName: string;
  glazeId: string;
  glazeName: string;
  quantity: number;
  neededBy: string;
  status: PotteryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PotteryInput {
  itemId: string;
  glazeId: string;
  quantity: number;
  neededBy: string;
}

const SELECT_REQUEST = `
  SELECT r.id, r.customer_id AS customerId, u.name AS customerName, u.email AS customerEmail,
         r.item_id AS itemId, i.name AS itemName, r.glaze_id AS glazeId, g.name AS glazeName,
         r.quantity, r.needed_by AS neededBy, r.status,
         r.created_at AS createdAt, r.updated_at AS updatedAt
  FROM pottery_requests r
  JOIN users u ON u.id = r.customer_id
  JOIN pottery_items i ON i.id = r.item_id
  JOIN glazes g ON g.id = r.glaze_id`;

export function listOptions(ctx: AppContext) {
  return {
    items: ctx.db.prepare('SELECT id, name FROM pottery_items ORDER BY id').all() as { id: string; name: string }[],
    glazes: ctx.db.prepare('SELECT id, name FROM glazes ORDER BY id').all() as { id: string; name: string }[],
  };
}

export function listRequests(ctx: AppContext, user: Viewer): PotteryRequest[] {
  if (user.role === 'studio') {
    return ctx.db.prepare(`${SELECT_REQUEST} ORDER BY r.id DESC`).all() as PotteryRequest[];
  }
  return ctx.db
    .prepare(`${SELECT_REQUEST} WHERE r.customer_id = ? ORDER BY r.id DESC`)
    .all(user.id) as PotteryRequest[];
}

/** 404 for a missing request AND for another customer's request. */
export function getRequest(ctx: AppContext, user: Viewer, id: number): PotteryRequest {
  const row = (
    user.role === 'studio'
      ? ctx.db.prepare(`${SELECT_REQUEST} WHERE r.id = ?`).get(id)
      : ctx.db.prepare(`${SELECT_REQUEST} WHERE r.id = ? AND r.customer_id = ?`).get(id, user.id)
  ) as PotteryRequest | undefined;
  if (!row) throw notFound('Pottery request');
  return row;
}

/** Checks the parts of the input that need the database or today's date. */
function validateAgainstData(ctx: AppContext, input: Partial<PotteryInput>) {
  const problems: { field: string; message: string }[] = [];
  if (input.itemId !== undefined && !ctx.db.prepare('SELECT 1 FROM pottery_items WHERE id = ?').get(input.itemId)) {
    problems.push({ field: 'itemId', message: 'Unknown pottery item' });
  }
  if (input.glazeId !== undefined && !ctx.db.prepare('SELECT 1 FROM glazes WHERE id = ?').get(input.glazeId)) {
    problems.push({ field: 'glazeId', message: 'Unknown glaze' });
  }
  if (input.neededBy !== undefined) {
    const today = todayIn(ctx.config.studioTimezone, ctx.clock());
    if (daysBetween(today, input.neededBy) < POTTERY_RULES.minDaysAhead) {
      problems.push({
        field: 'neededBy',
        message: `Needed-by date must be at least ${POTTERY_RULES.minDaysAhead} days from today`,
      });
    }
  }
  if (problems.length > 0) {
    throw badRequest(problems.map((p) => `${p.field}: ${p.message}`).join('; '), problems);
  }
}

export function createRequest(ctx: AppContext, customerId: number, input: PotteryInput): PotteryRequest {
  validateAgainstData(ctx, input);
  const now = ctx.clock().toISOString();
  const result = ctx.db
    .prepare(
      `INSERT INTO pottery_requests (customer_id, item_id, glaze_id, quantity, needed_by, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'requested', ?, ?)`,
    )
    .run(customerId, input.itemId, input.glazeId, input.quantity, input.neededBy, now, now);
  return getRequest(ctx, { id: customerId, role: 'customer' }, Number(result.lastInsertRowid));
}

function assertStillRequested(request: PotteryRequest, action: 'edited' | 'cancelled') {
  if (request.status !== 'requested') {
    throw conflict(
      action === 'edited' ? 'REQUEST_NOT_EDITABLE' : 'REQUEST_NOT_CANCELLABLE',
      `This request can no longer be ${action} because it is ${request.status}.`,
    );
  }
}

/** Customer edit. Allowed only while the request is still 'requested'. */
export function updateRequest(
  ctx: AppContext,
  customer: Viewer,
  id: number,
  patch: Partial<PotteryInput>,
): PotteryRequest {
  ctx.db.transaction(() => {
    assertStillRequested(getRequest(ctx, customer, id), 'edited');
    validateAgainstData(ctx, patch);
    const current = getRequest(ctx, customer, id);
    const next = { ...current, ...patch };
    // "AND status = 'requested'" repeats the check inside the write itself, so a
    // studio decision that lands at the same moment always wins cleanly.
    const result = ctx.db
      .prepare(
        `UPDATE pottery_requests SET item_id = ?, glaze_id = ?, quantity = ?, needed_by = ?, updated_at = ?
         WHERE id = ? AND customer_id = ? AND status = 'requested'`,
      )
      .run(next.itemId, next.glazeId, next.quantity, next.neededBy, ctx.clock().toISOString(), id, customer.id);
    if (result.changes === 0) assertStillRequested(getRequest(ctx, customer, id), 'edited');
  })();
  return getRequest(ctx, customer, id);
}

export function cancelRequest(ctx: AppContext, customer: Viewer, id: number): PotteryRequest {
  ctx.db.transaction(() => {
    assertStillRequested(getRequest(ctx, customer, id), 'cancelled');
    ctx.db
      .prepare(
        `UPDATE pottery_requests SET status = 'cancelled', updated_at = ?
         WHERE id = ? AND customer_id = ? AND status = 'requested'`,
      )
      .run(ctx.clock().toISOString(), id, customer.id);
  })();
  return getRequest(ctx, customer, id);
}

/** Studio decision. Only a 'requested' request can be accepted or declined. */
export function decideRequest(ctx: AppContext, id: number, decision: 'accepted' | 'declined'): PotteryRequest {
  const studio: Viewer = { id: 0, role: 'studio' };
  const result = ctx.db
    .prepare(`UPDATE pottery_requests SET status = ?, updated_at = ? WHERE id = ? AND status = 'requested'`)
    .run(decision, ctx.clock().toISOString(), id);
  if (result.changes === 0) {
    const request = getRequest(ctx, studio, id); // 404 if missing
    throw conflict(
      'REQUEST_NOT_PENDING',
      `Only requested pottery requests can be accepted or declined. This one is ${request.status}.`,
    );
  }
  return getRequest(ctx, studio, id);
}
