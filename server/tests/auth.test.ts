import { describe, expect, it } from 'vitest';
import { setup, STUDIO_EMAIL, STUDIO_PASSWORD } from './helpers.js';

describe('authentication', () => {
  it('registers a customer, returns the session user, and never exposes the password hash', async () => {
    const t = setup();
    const agent = await t.customer();
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ role: 'customer', email: 'customer1@example.com' });
    expect(JSON.stringify(me.body)).not.toContain('password');
  });

  it('stores passwords hashed, not in plain text', async () => {
    const t = setup();
    await t.customer();
    const row = t.db.prepare('SELECT password_hash FROM users WHERE email = ?').get('customer1@example.com') as {
      password_hash: string;
    };
    expect(row.password_hash).not.toBe('password123');
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    const t = setup();
    await t.customer();
    const res = await t
      .anon()
      .post('/api/auth/register')
      .send({ name: 'Again', email: 'CUSTOMER1@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('refuses to let sign-up choose a role (no studio self-registration)', async () => {
    const t = setup();
    const res = await t
      .anon()
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'password123', role: 'studio' });
    expect(res.status).toBe(400);
    const exists = t.db.prepare('SELECT 1 FROM users WHERE email = ?').get('sneaky@example.com');
    expect(exists).toBeUndefined();
  });

  it('validates registration input', async () => {
    const t = setup();
    const res = await t.anon().post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });

  it('logs in the seeded studio account', async () => {
    const t = setup();
    const res = await t.anon().post('/api/auth/login').send({ email: STUDIO_EMAIL, password: STUDIO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('studio');
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  });

  it('rejects a wrong password with 401', async () => {
    const t = setup();
    const res = await t.anon().post('/api/auth/login').send({ email: STUDIO_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logout ends the session on the server', async () => {
    const t = setup();
    const agent = await t.customer();
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('expired sessions are rejected', async () => {
    const t = setup();
    const agent = await t.customer();
    t.setNow('2027-01-01T00:00:00.000Z'); // well past the session lifetime
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const t = setup();
    const res = await t.anon().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});
