import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { openDatabase, type DB } from '../src/db/database.js';
import { readSeedFile, seedDatabase } from '../src/db/seed.js';

// These tests talk to the database directly, through TWO separate connections
// to the same file, the way two server processes would. They show that the
// "one painting / one date" rules hold even without any application code.

const seed = readSeedFile(loadConfig().seedFile);
let dir: string;
let connections: DB[] = [];

function twoConnections() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-studio-test-'));
  const file = path.join(dir, 'test.db');
  const a = openDatabase(file);
  seedDatabase(a, seed, { bcryptRounds: 4 });
  a.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES ('c@x.com', 'C', 'x', 'customer')`).run();
  const b = openDatabase(file);
  connections = [a, b];
  return { a, b };
}

afterEach(() => {
  connections.forEach((c) => c.close());
  connections = [];
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe('database constraints', () => {
  it('two connections cannot both hold an active booking for one date', () => {
    const { a, b } = twoConnections();
    const insert = `INSERT INTO wall_bookings (customer_id, booking_date, wall_size_sqft, address, rate_per_sqft, price)
                    VALUES ((SELECT id FROM users WHERE email = 'c@x.com'), '2026-12-01', 100, 'Addr', 150, 15000)`;
    a.prepare(insert).run();
    expect(() => b.prepare(insert).run()).toThrow(/UNIQUE/);
  });

  it('two connections cannot both claim the same painting', () => {
    const { a, b } = twoConnections();
    const claim = `UPDATE paintings SET status = 'sold' WHERE id = 'p-001' AND status = 'available'`;
    expect(a.prepare(claim).run().changes).toBe(1);
    expect(b.prepare(claim).run().changes).toBe(0); // second buyer sees nothing to claim
  });

  it('rejects invalid status values and out-of-range numbers', () => {
    const { a } = twoConnections();
    expect(() => a.prepare(`UPDATE paintings SET status = 'reserved' WHERE id = 'p-001'`).run()).toThrow(/CHECK/);
    expect(() =>
      a
        .prepare(
          `INSERT INTO pottery_requests (customer_id, item_id, glaze_id, quantity, needed_by) VALUES ((SELECT id FROM users WHERE email = 'c@x.com'), 'i-01', 'g-01', 13, '2026-12-01')`,
        )
        .run(),
    ).toThrow(/CHECK/);
  });

  it('rejects references to pottery items or glazes that do not exist', () => {
    const { a } = twoConnections();
    expect(() =>
      a
        .prepare(
          `INSERT INTO pottery_requests (customer_id, item_id, glaze_id, quantity, needed_by) VALUES ((SELECT id FROM users WHERE email = 'c@x.com'), 'i-99', 'g-01', 1, '2026-12-01')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('seeding twice does not duplicate rows or un-sell a painting', () => {
    const { a } = twoConnections();
    a.prepare(`UPDATE paintings SET status = 'sold' WHERE id = 'p-001'`).run();
    const second = seedDatabase(a, seed, { bcryptRounds: 4 });
    expect(second).toEqual({ paintingsInserted: 0, studioCreated: false });
    expect(a.prepare('SELECT COUNT(*) AS n FROM paintings').get()).toEqual({ n: 12 });
    expect(a.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'studio'`).get()).toEqual({ n: 1 });
    expect(a.prepare(`SELECT status FROM paintings WHERE id = 'p-001'`).get()).toEqual({ status: 'sold' });
  });
});
