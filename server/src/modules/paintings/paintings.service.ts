import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';

export interface Painting {
  id: string;
  title: string;
  artist: string;
  description: string;
  price: number;
  imageUrl: string | null;
  status: 'available' | 'sold';
  createdAt: string;
  updatedAt: string;
}

export interface PaintingInput {
  title: string;
  artist: string;
  description: string;
  price: number;
  imageUrl?: string | null;
}

const SELECT_PAINTING = `
  SELECT id, title, artist, description, price, image_url AS imageUrl, status,
         created_at AS createdAt, updated_at AS updatedAt
  FROM paintings`;

export function listPaintings(ctx: AppContext, status?: Painting['status']): Painting[] {
  if (status) {
    return ctx.db.prepare(`${SELECT_PAINTING} WHERE status = ? ORDER BY id`).all(status) as Painting[];
  }
  return ctx.db.prepare(`${SELECT_PAINTING} ORDER BY id`).all() as Painting[];
}

export function getPainting(ctx: AppContext, id: string): Painting {
  const painting = ctx.db.prepare(`${SELECT_PAINTING} WHERE id = ?`).get(id) as Painting | undefined;
  if (!painting) throw notFound('Painting');
  return painting;
}

/** New paintings continue the seed's id scheme: p-001 … p-012, then p-013, … */
function nextPaintingId(ctx: AppContext): string {
  const row = ctx.db
    .prepare(
      `SELECT MAX(CAST(substr(id, 3) AS INTEGER)) AS maxNum FROM paintings WHERE id GLOB 'p-[0-9]*'`,
    )
    .get() as { maxNum: number | null };
  return `p-${String((row.maxNum ?? 0) + 1).padStart(3, '0')}`;
}

export function createPainting(ctx: AppContext, input: PaintingInput): Painting {
  const now = ctx.clock().toISOString();
  const id = ctx.db.transaction(() => {
    const newId = nextPaintingId(ctx);
    ctx.db
      .prepare(
        `INSERT INTO paintings (id, title, artist, description, price, image_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      )
      .run(newId, input.title, input.artist, input.description, input.price, input.imageUrl ?? null, now, now);
    return newId;
  })();
  return getPainting(ctx, id);
}

/**
 * Edits a painting, but only while it is available. The status check is part of
 * the UPDATE's WHERE clause, so a purchase landing at the same moment cannot
 * slip in between "check" and "write".
 */
export function updatePainting(ctx: AppContext, id: string, patch: Partial<PaintingInput>): Painting {
  // Only these columns can ever be changed; status/id are not in the list.
  const columns: Record<keyof PaintingInput, string> = {
    title: 'title',
    artist: 'artist',
    description: 'description',
    price: 'price',
    imageUrl: 'image_url',
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(columns) as (keyof PaintingInput)[]) {
    if (patch[key] !== undefined) {
      sets.push(`${columns[key]} = ?`);
      values.push(patch[key]);
    }
  }
  sets.push('updated_at = ?');
  values.push(ctx.clock().toISOString());

  const result = ctx.db
    .prepare(`UPDATE paintings SET ${sets.join(', ')} WHERE id = ? AND status = 'available'`)
    .run(...values, id);

  if (result.changes === 0) {
    getPainting(ctx, id); // throws 404 if it does not exist
    throw conflict('PAINTING_NOT_EDITABLE', 'This painting has been sold and can no longer be edited.');
  }
  return getPainting(ctx, id);
}
