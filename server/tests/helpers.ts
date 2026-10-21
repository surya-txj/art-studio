import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';
import { readSeedFile, seedDatabase } from '../src/db/seed.js';
import { addDays } from '../src/lib/dates.js';

export const STUDIO_EMAIL = 'studio@artstudio.in';
const seed = readSeedFile(loadConfig().seedFile);
export const STUDIO_PASSWORD = seed.studioAccount.password;
export const RATE = seed.mural.ratePerSqFt;

/** "Today" in every test is 1 Nov 2026 (noon in IST), unless a test moves the clock. */
export const TODAY = '2026-11-01';
const DEFAULT_NOW = new Date('2026-11-01T06:30:00.000Z');

export const daysFromToday = (days: number) => addDays(TODAY, days);

/** A fresh in-memory database, seeded, with a clock the test controls. */
export function setup() {
  // 30-day sessions so tests can move the clock forward a week without being logged out.
  const config = { ...loadConfig(), databaseFile: ':memory:', bcryptRounds: 4, sessionTtlHours: 24 * 30 };
  const db = openDatabase(':memory:');
  seedDatabase(db, seed, { bcryptRounds: 4 });

  let now = DEFAULT_NOW;
  const clock = () => now;
  const app = createApp({ db, clock, config });

  let counter = 0;
  /** Registers a brand-new customer and returns an agent that keeps their session cookie. */
  async function customer(): Promise<TestAgent> {
    counter += 1;
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .send({ name: `Customer ${counter}`, email: `customer${counter}@example.com`, password: 'password123' });
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function studio(): Promise<TestAgent> {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email: STUDIO_EMAIL, password: STUDIO_PASSWORD });
    if (res.status !== 200) throw new Error(`studio login failed: ${res.status}`);
    return agent;
  }

  return {
    app,
    db,
    anon: () => request(app),
    customer,
    studio,
    setNow: (iso: string) => {
      now = new Date(iso);
    },
  };
}
