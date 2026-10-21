import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

const newPainting = {
  title: 'Test Canvas',
  artist: 'Test Artist',
  description: 'Acrylic on canvas.',
  price: 4200,
};

describe('browsing paintings', () => {
  it('lists the 12 seeded paintings, with the two sold ones marked sold', async () => {
    const t = setup();
    const res = await t.anon().get('/api/paintings');
    expect(res.status).toBe(200);
    expect(res.body.paintings).toHaveLength(12);
    const sold = res.body.paintings.filter((p: { status: string }) => p.status === 'sold').map((p: { id: string }) => p.id);
    expect(sold).toEqual(['p-004', 'p-009']);
  });

  it('returns 404 for an unknown painting', async () => {
    const t = setup();
    expect((await t.anon().get('/api/paintings/p-999')).status).toBe(404);
  });
});

describe('managing paintings (studio only)', () => {
  it('401 when not logged in, 403 for a customer', async () => {
    const t = setup();
    expect((await t.anon().post('/api/paintings').send(newPainting)).status).toBe(401);
    const customer = await t.customer();
    const res = await customer.post('/api/paintings').send(newPainting);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await customer.patch('/api/paintings/p-001').send({ price: 1 })).status).toBe(403);
  });

  it('studio can add a painting; it gets the next id and starts available', async () => {
    const t = setup();
    const studio = await t.studio();
    const res = await studio.post('/api/paintings').send(newPainting);
    expect(res.status).toBe(201);
    expect(res.body.painting).toMatchObject({ id: 'p-013', status: 'available', price: 4200 });
  });

  it('rejects invalid painting input', async () => {
    const t = setup();
    const studio = await t.studio();
    const res = await studio.post('/api/paintings').send({ ...newPainting, price: -5, title: '' });
    expect(res.status).toBe(400);
  });

  it('studio can edit an available painting', async () => {
    const t = setup();
    const studio = await t.studio();
    const res = await studio.patch('/api/paintings/p-001').send({ price: 7000 });
    expect(res.status).toBe(200);
    expect(res.body.painting.price).toBe(7000);
  });

  it('editing a sold painting is rejected with 409', async () => {
    const t = setup();
    const studio = await t.studio();
    const res = await studio.patch('/api/paintings/p-004').send({ price: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAINTING_NOT_EDITABLE');
  });

  it('status cannot be changed through an edit (mass-assignment guard)', async () => {
    const t = setup();
    const studio = await t.studio();
    const res = await studio.patch('/api/paintings/p-004').send({ status: 'available' });
    expect(res.status).toBe(400);
    expect((await t.anon().get('/api/paintings/p-004')).body.painting.status).toBe('sold');
  });
});
