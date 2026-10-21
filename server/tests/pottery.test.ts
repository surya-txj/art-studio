import { describe, expect, it } from 'vitest';
import { daysFromToday, setup } from './helpers.js';

const valid = (overrides: Record<string, unknown> = {}) => ({
  itemId: 'i-01',
  glazeId: 'g-03',
  quantity: 6,
  neededBy: daysFromToday(20),
  ...overrides,
});

describe('pottery options', () => {
  it('lists the seeded items and glazes', async () => {
    const t = setup();
    const res = await t.anon().get('/api/pottery-options');
    expect(res.body.items).toHaveLength(5);
    expect(res.body.glazes).toHaveLength(6);
    expect(res.body.items[0]).toEqual({ id: 'i-01', name: 'Kulhad (clay cup)' });
  });
});

describe('creating pottery requests', () => {
  it('401 when not logged in; 403 for the studio', async () => {
    const t = setup();
    expect((await t.anon().post('/api/pottery-requests').send(valid())).status).toBe(401);
    const studio = await t.studio();
    expect((await studio.post('/api/pottery-requests').send(valid())).status).toBe(403);
  });

  it('accepts a valid request with status requested', async () => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/pottery-requests').send(valid());
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({
      status: 'requested',
      itemName: 'Kulhad (clay cup)',
      glazeName: 'Mehendi Green',
      quantity: 6,
    });
  });

  it('rejects an unknown item or glaze', async () => {
    const t = setup();
    const customer = await t.customer();
    const badItem = await customer.post('/api/pottery-requests').send(valid({ itemId: 'i-99' }));
    expect(badItem.status).toBe(400);
    expect(badItem.body.error.details).toEqual([{ field: 'itemId', message: 'Unknown pottery item' }]);
    expect((await customer.post('/api/pottery-requests').send(valid({ glazeId: 'g-99' }))).status).toBe(400);
  });

  it.each([0, 13, -1, 2.5])('quantity %s is rejected', async (quantity) => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/pottery-requests').send(valid({ quantity }))).status).toBe(400);
  });

  it.each([1, 12])('quantity %s (boundary) is accepted', async (quantity) => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/pottery-requests').send(valid({ quantity }))).status).toBe(201);
  });

  it.each([
    [13, 400],
    [0, 400],
    [14, 201],
    [200, 201],
  ])('needed-by %i days away → %i', async (days, expected) => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/pottery-requests').send(valid({ neededBy: daysFromToday(days) }));
    expect(res.status).toBe(expected);
  });

  it('cannot set the status on create', async () => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/pottery-requests').send(valid({ status: 'accepted' }))).status).toBe(400);
  });
});

describe('editing and cancelling pottery requests', () => {
  async function withRequest() {
    const t = setup();
    const customer = await t.customer();
    const request = (await customer.post('/api/pottery-requests').send(valid())).body.request;
    return { t, customer, request };
  }

  it('owner can edit a requested request', async () => {
    const { customer, request } = await withRequest();
    const res = await customer.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 12, glazeId: 'g-04' });
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ quantity: 12, glazeName: 'Indigo Blue', status: 'requested' });
  });

  it('edits are validated the same way as creation', async () => {
    const { customer, request } = await withRequest();
    expect((await customer.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 13 })).status).toBe(400);
    expect((await customer.patch(`/api/pottery-requests/${request.id}`).send({ itemId: 'nope' })).status).toBe(400);
    expect(
      (await customer.patch(`/api/pottery-requests/${request.id}`).send({ neededBy: daysFromToday(5) })).status,
    ).toBe(400);
    expect((await customer.patch(`/api/pottery-requests/${request.id}`).send({ status: 'accepted' })).status).toBe(400);
  });

  it('owner can cancel a requested request', async () => {
    const { customer, request } = await withRequest();
    const res = await customer.post(`/api/pottery-requests/${request.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('cancelled');
  });

  it.each(['accept', 'decline'])('after the studio %ss, the customer cannot edit or cancel', async (action) => {
    const { t, customer, request } = await withRequest();
    const studio = await t.studio();
    expect((await studio.post(`/api/pottery-requests/${request.id}/${action}`)).status).toBe(200);

    const edit = await customer.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 2 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('REQUEST_NOT_EDITABLE');
    const cancel = await customer.post(`/api/pottery-requests/${request.id}/cancel`);
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.code).toBe('REQUEST_NOT_CANCELLABLE');
  });

  it('a cancelled request cannot be edited', async () => {
    const { customer, request } = await withRequest();
    await customer.post(`/api/pottery-requests/${request.id}/cancel`);
    expect((await customer.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 2 })).status).toBe(409);
  });

  it("another customer cannot see, edit or cancel it (404)", async () => {
    const { t, request } = await withRequest();
    const other = await t.customer();
    expect((await other.get(`/api/pottery-requests/${request.id}`)).status).toBe(404);
    expect((await other.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 1 })).status).toBe(404);
    expect((await other.post(`/api/pottery-requests/${request.id}/cancel`)).status).toBe(404);
    expect((await other.get('/api/pottery-requests')).body.requests).toEqual([]);
  });
});

describe('studio decisions on pottery', () => {
  it('studio can accept, sees all requests, and cannot decide twice', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    const request = (await a.post('/api/pottery-requests').send(valid())).body.request;
    await b.post('/api/pottery-requests').send(valid({ itemId: 'i-02' }));

    const studio = await t.studio();
    expect((await studio.get('/api/pottery-requests')).body.requests).toHaveLength(2);
    expect((await studio.post(`/api/pottery-requests/${request.id}/accept`)).body.request.status).toBe('accepted');

    const again = await studio.post(`/api/pottery-requests/${request.id}/decline`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REQUEST_NOT_PENDING');
  });

  it('studio can decline', async () => {
    const t = setup();
    const a = await t.customer();
    const request = (await a.post('/api/pottery-requests').send(valid())).body.request;
    const studio = await t.studio();
    expect((await studio.post(`/api/pottery-requests/${request.id}/decline`)).body.request.status).toBe('declined');
  });

  it('studio cannot edit or cancel a customer request; customer cannot accept (403)', async () => {
    const t = setup();
    const a = await t.customer();
    const request = (await a.post('/api/pottery-requests').send(valid())).body.request;
    const studio = await t.studio();
    expect((await studio.patch(`/api/pottery-requests/${request.id}`).send({ quantity: 1 })).status).toBe(403);
    expect((await studio.post(`/api/pottery-requests/${request.id}/cancel`)).status).toBe(403);
    expect((await a.post(`/api/pottery-requests/${request.id}/accept`)).status).toBe(403);
  });
});
