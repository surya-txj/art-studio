import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DB } from './database.js';

// Shape of the supplied seed-data/seed.json. Parsing it with Zod means a broken
// seed file fails loudly instead of silently inserting bad rows.
const seedSchema = z.object({
  currency: z.string().min(1),
  paintings: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      artist: z.string().min(1),
      description: z.string(),
      price: z.number().int().positive(),
      imageUrl: z.string().nullable().optional(),
      status: z.enum(['available', 'sold']),
    }),
  ),
  potteryItems: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  glazes: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  mural: z.object({ ratePerSqFt: z.number().int().positive() }),
  studioAccount: z.object({
    email: z.email(),
    password: z.string().min(1),
    role: z.literal('studio'),
  }),
});

export type SeedData = z.infer<typeof seedSchema>;

export function readSeedFile(file: string): SeedData {
  return seedSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export interface SeedOptions {
  bcryptRounds: number;
  /** Optional override so the studio password does not have to be the one in seed.json. */
  studioPassword?: string;
}

/**
 * Loads seed data into the database. Safe to run any number of times:
 *  - catalogue rows (items, glazes, settings) are upserted from the file;
 *  - paintings are inserted only if missing, so a re-seed never "un-sells" a
 *    painting a customer has bought or wipes a studio edit;
 *  - the studio account is created only if its email is not registered yet.
 */
export function seedDatabase(db: DB, seed: SeedData, options: SeedOptions) {
  const upsertSetting = db.prepare(
    `INSERT INTO studio_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  const insertPainting = db.prepare(
    `INSERT INTO paintings (id, title, artist, description, price, image_url, status)
     VALUES (@id, @title, @artist, @description, @price, @imageUrl, @status)
     ON CONFLICT(id) DO NOTHING`,
  );
  const upsertItem = db.prepare(
    `INSERT INTO pottery_items (id, name) VALUES (@id, @name)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  );
  const upsertGlaze = db.prepare(
    `INSERT INTO glazes (id, name) VALUES (@id, @name)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  );

  const studio = seed.studioAccount;
  const studioExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(studio.email);
  // Hash outside the transaction: bcrypt is deliberately slow.
  const studioHash = studioExists
    ? null
    : bcrypt.hashSync(options.studioPassword || studio.password, options.bcryptRounds);

  const counts = { paintingsInserted: 0, studioCreated: false };

  db.transaction(() => {
    upsertSetting.run('currency', seed.currency);
    upsertSetting.run('mural_rate_per_sqft', String(seed.mural.ratePerSqFt));

    for (const p of seed.paintings) {
      const result = insertPainting.run({
        ...p,
        // seed.json uses paths relative to the seed folder; the server serves them at /images.
        imageUrl: p.imageUrl ? `/${p.imageUrl.replace(/^\/+/, '')}` : null,
      });
      counts.paintingsInserted += result.changes;
    }
    for (const item of seed.potteryItems) upsertItem.run(item);
    for (const glaze of seed.glazes) upsertGlaze.run(glaze);

    if (studioHash) {
      db.prepare(
        `INSERT INTO users (email, name, password_hash, role) VALUES (?, 'Studio Admin', ?, 'studio')`,
      ).run(studio.email, studioHash);
      counts.studioCreated = true;
    }
  })();

  return counts;
}
