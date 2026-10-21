import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('buying paintings', () => {
  it('401 when not logged in; 403 for the studio', async () => {
    const t = setup();
    expect((await t.anon().post('/api/orders').send({ paintingId: 'p-001' })).status).toBe(401);
    const studio = await t.studio();
    expect((await studio.post('/api/orders').send({ paintingId: 'p-001' })).status).toBe(403);
  });

  it('a customer can buy an available painting; it becomes sold', async () => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/orders').send({ paintingId: 'p-001' });
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ paintingId: 'p-001', status: 'placed', price: 6500 });
    expect((await t.anon().get('/api/paintings/p-001')).body.painting.status).toBe('sold');
  });

  it('price comes from the database, not the request', async () => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/orders').send({ paintingId: 'p-001', price: 1 });
    expect(res.status).toBe(400); // unknown field rejected outright
  });

  it('a sold painting cannot be bought again', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    expect((await a.post('/api/orders').send({ paintingId: 'p-002' })).status).toBe(201);
    const res = await b.post('/api/orders').send({ paintingId: 'p-002' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'PAINTING_SOLD', message: 'This painting has already been sold.' });
  });

  it('a painting seeded as sold cannot be bought', async () => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/orders').send({ paintingId: 'p-004' })).status).toBe(409);
  });

  it('unknown painting gives 404', async () => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/orders').send({ paintingId: 'p-999' })).status).toBe(404);
  });

  it('two simultaneous purchases of the same painting: exactly one succeeds', async () => {
    const t = setup();
    const buyers = await Promise.all([t.customer(), t.customer(), t.customer(), t.customer()]);
    const results = await Promise.all(buyers.map((b) => b.post('/api/orders').send({ paintingId: 'p-003' })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);
    const placed = t.db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE painting_id = 'p-003' AND status = 'placed'`).get();
    expect(placed).toEqual({ n: 1 });
  });

  it('the database itself refuses a second placed order for one painting', async () => {
    // Even if application code had a bug, the partial unique index would stop a double sale.
    const t = setup();
    const customer = await t.customer();
    await customer.post('/api/orders').send({ paintingId: 'p-005' });
    const userId = (t.db.prepare('SELECT id FROM users WHERE role = ?').get('customer') as { id: number }).id;
    expect(() =>
      t.db.prepare(`INSERT INTO orders (painting_id, customer_id, price, status) VALUES ('p-005', ?, 9200, 'placed')`).run(userId),
    ).toThrow(/UNIQUE/);
  });
});

describe('cancelling orders', () => {
  it('cancelling restores availability, and the painting can be bought again', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    const order = (await a.post('/api/orders').send({ paintingId: 'p-006' })).body.order;

    const res = await a.post(`/api/orders/${order.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
    expect((await t.anon().get('/api/paintings/p-006')).body.painting.status).toBe('available');

    expect((await b.post('/api/orders').send({ paintingId: 'p-006' })).status).toBe(201);
  });

  it('cannot cancel twice', async () => {
    const t = setup();
    const a = await t.customer();
    const order = (await a.post('/api/orders').send({ paintingId: 'p-006' })).body.order;
    await a.post(`/api/orders/${order.id}/cancel`);
    const res = await a.post(`/api/orders/${order.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });

  it("a customer cannot see or cancel another customer's order (404)", async () => {
    const t = setup();
    const owner = await t.customer();
    const other = await t.customer();
    const order = (await owner.post('/api/orders').send({ paintingId: 'p-007' })).body.order;

    expect((await other.get(`/api/orders/${order.id}`)).status).toBe(404);
    expect((await other.post(`/api/orders/${order.id}/cancel`)).status).toBe(404);
    expect((await other.get('/api/orders')).body.orders).toEqual([]);
    expect((await t.anon().get('/api/paintings/p-007')).body.painting.status).toBe('sold');
  });

  it('the studio sees all orders but cannot cancel them', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    await a.post('/api/orders').send({ paintingId: 'p-001' });
    const order = (await b.post('/api/orders').send({ paintingId: 'p-002' })).body.order;

    const studio = await t.studio();
    const list = await studio.get('/api/orders');
    expect(list.body.orders).toHaveLength(2);
    expect((await studio.get(`/api/orders/${order.id}`)).status).toBe(200);
    expect((await studio.post(`/api/orders/${order.id}/cancel`)).status).toBe(403);
  });

  it('rejects a non-numeric order id with 400', async () => {
    const t = setup();
    const a = await t.customer();
    expect((await a.get('/api/orders/abc')).status).toBe(400);
  });
});
