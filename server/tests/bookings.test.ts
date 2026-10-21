import { describe, expect, it } from 'vitest';
import { daysFromToday, RATE, setup } from './helpers.js';

const valid = (overrides: Record<string, unknown> = {}) => ({
  date: daysFromToday(10),
  wallSizeSqft: 120,
  address: '12 MG Road, Hyderabad',
  ...overrides,
});

describe('creating wall bookings', () => {
  it('401 when not logged in; 403 for the studio', async () => {
    const t = setup();
    expect((await t.anon().post('/api/bookings').send(valid())).status).toBe(401);
    const studio = await t.studio();
    expect((await studio.post('/api/bookings').send(valid())).status).toBe(403);
  });

  it('accepts a valid booking with status requested and price = size × seeded rate', async () => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/bookings').send(valid());
    expect(res.status).toBe(201);
    expect(RATE).toBe(150); // the value in seed.json
    expect(res.body.booking).toMatchObject({
      status: 'requested',
      wallSizeSqft: 120,
      ratePerSqft: 150,
      price: 120 * 150,
      date: daysFromToday(10),
    });
  });

  it('ignores any price the client tries to send (rejected as an unknown field)', async () => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/bookings').send(valid({ price: 1 }));
    expect(res.status).toBe(400);
  });

  it.each([
    [6, 400],
    [7, 201],
    [90, 201],
    [91, 400],
    [0, 400],
    [-3, 400],
  ])('date %i days away → %i', async (days, expected) => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/bookings').send(valid({ date: daysFromToday(days) }));
    expect(res.status).toBe(expected);
  });

  it('counts days in studio time (IST), not UTC', async () => {
    const t = setup();
    // 20:00 UTC on 1 Nov is already 2 Nov in India, so 1 Nov + 7 is only 6 days away.
    t.setNow('2026-11-01T20:00:00.000Z');
    const customer = await t.customer();
    expect((await customer.post('/api/bookings').send(valid({ date: daysFromToday(7) }))).status).toBe(400);
    expect((await customer.post('/api/bookings').send(valid({ date: daysFromToday(8) }))).status).toBe(201);
  });

  it.each([9, 501, 0, -10, 50.5])('wall size %s is rejected', async (size) => {
    const t = setup();
    const customer = await t.customer();
    expect((await customer.post('/api/bookings').send(valid({ wallSizeSqft: size }))).status).toBe(400);
  });

  it.each([10, 500])('wall size %s (boundary) is accepted', async (size) => {
    const t = setup();
    const customer = await t.customer();
    const res = await customer.post('/api/bookings').send(valid({ wallSizeSqft: size }));
    expect(res.status).toBe(201);
    expect(res.body.booking.price).toBe(size * RATE);
  });

  it('missing or blank address is rejected', async () => {
    const t = setup();
    const customer = await t.customer();
    const { address: _omit, ...noAddress } = valid();
    expect((await customer.post('/api/bookings').send(noAddress)).status).toBe(400);
    expect((await customer.post('/api/bookings').send(valid({ address: '   ' }))).status).toBe(400);
  });

  it('invalid date strings are rejected', async () => {
    const t = setup();
    const customer = await t.customer();
    for (const date of ['2026-02-30', '11/20/2026', 'tomorrow', '']) {
      expect((await customer.post('/api/bookings').send(valid({ date }))).status).toBe(400);
    }
  });

  it('a date that is already booked is rejected with a clear message', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    await a.post('/api/bookings').send(valid());
    const res = await b.post('/api/bookings').send(valid());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DATE_TAKEN');
    expect(res.body.error.message).toContain('no longer available');
  });

  it('simultaneous bookings for the same date: exactly one succeeds', async () => {
    const t = setup();
    const customers = await Promise.all([t.customer(), t.customer(), t.customer()]);
    const results = await Promise.all(customers.map((c) => c.post('/api/bookings').send(valid())));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it('a declined or cancelled booking frees the date again', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    const c = await t.customer();
    const studio = await t.studio();

    const first = (await a.post('/api/bookings').send(valid())).body.booking;
    await studio.post(`/api/bookings/${first.id}/decline`);
    const second = (await b.post('/api/bookings').send(valid())).body.booking;
    expect(second.status).toBe('requested');

    await b.post(`/api/bookings/${second.id}/cancel`);
    expect((await c.post('/api/bookings').send(valid())).status).toBe(201);
  });

  it('unavailable-dates lists held dates without any customer details', async () => {
    const t = setup();
    const a = await t.customer();
    await a.post('/api/bookings').send(valid());
    const res = await a.get('/api/bookings/unavailable-dates');
    expect(res.body).toEqual({ dates: [daysFromToday(10)] });
  });
});

describe('cancelling wall bookings', () => {
  async function bookedOn(daysAway: number) {
    const t = setup();
    const customer = await t.customer();
    const booking = (await customer.post('/api/bookings').send(valid({ date: daysFromToday(daysAway) }))).body.booking;
    return { t, customer, booking };
  }

  it('can cancel when the booking is more than 3 days away', async () => {
    const { customer, booking } = await bookedOn(10);
    const res = await customer.post(`/api/bookings/${booking.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('cancelled');
  });

  it('can still cancel exactly 3 days before the date', async () => {
    const { t, customer, booking } = await bookedOn(10);
    t.setNow(`${daysFromToday(7)}T06:30:00.000Z`); // booking is now 3 days away
    expect((await customer.post(`/api/bookings/${booking.id}/cancel`)).status).toBe(200);
  });

  it('cannot cancel 2 days before the date', async () => {
    const { t, customer, booking } = await bookedOn(10);
    t.setNow(`${daysFromToday(8)}T06:30:00.000Z`); // booking is now 2 days away
    const res = await customer.post(`/api/bookings/${booking.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'CANCELLATION_WINDOW_CLOSED',
      message: 'You cannot cancel this booking within three days of its date.',
    });
  });

  it('a confirmed booking can be cancelled by its owner (inside the window)', async () => {
    const { t, customer, booking } = await bookedOn(10);
    const studio = await t.studio();
    await studio.post(`/api/bookings/${booking.id}/confirm`);
    expect((await customer.post(`/api/bookings/${booking.id}/cancel`)).body.booking.status).toBe('cancelled');
  });

  it('a declined booking cannot be cancelled', async () => {
    const { t, customer, booking } = await bookedOn(10);
    const studio = await t.studio();
    await studio.post(`/api/bookings/${booking.id}/decline`);
    const res = await customer.post(`/api/bookings/${booking.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_CANCELLABLE');
  });

  it("another customer cannot see or cancel the booking (404)", async () => {
    const { t, booking } = await bookedOn(10);
    const other = await t.customer();
    expect((await other.get(`/api/bookings/${booking.id}`)).status).toBe(404);
    expect((await other.post(`/api/bookings/${booking.id}/cancel`)).status).toBe(404);
    expect((await other.get('/api/bookings')).body.bookings).toEqual([]);
  });

  it('the studio cannot cancel a customer booking (403)', async () => {
    const { t, booking } = await bookedOn(10);
    const studio = await t.studio();
    expect((await studio.post(`/api/bookings/${booking.id}/cancel`)).status).toBe(403);
  });
});

describe('studio decisions on bookings', () => {
  it('studio can confirm a requested booking, and sees all bookings', async () => {
    const t = setup();
    const a = await t.customer();
    const b = await t.customer();
    const booking = (await a.post('/api/bookings').send(valid())).body.booking;
    await b.post('/api/bookings').send(valid({ date: daysFromToday(20) }));

    const studio = await t.studio();
    expect((await studio.get('/api/bookings')).body.bookings).toHaveLength(2);
    const res = await studio.post(`/api/bookings/${booking.id}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('confirmed');
  });

  it('studio can decline a requested booking', async () => {
    const t = setup();
    const a = await t.customer();
    const booking = (await a.post('/api/bookings').send(valid())).body.booking;
    const studio = await t.studio();
    expect((await studio.post(`/api/bookings/${booking.id}/decline`)).body.booking.status).toBe('declined');
  });

  it('cannot confirm a booking that is not requested (e.g. already cancelled)', async () => {
    const t = setup();
    const a = await t.customer();
    const booking = (await a.post('/api/bookings').send(valid())).body.booking;
    await a.post(`/api/bookings/${booking.id}/cancel`);
    const studio = await t.studio();
    const res = await studio.post(`/api/bookings/${booking.id}/confirm`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_PENDING');
  });

  it('a customer cannot confirm or decline (403); unknown booking is 404 for studio', async () => {
    const t = setup();
    const a = await t.customer();
    const booking = (await a.post('/api/bookings').send(valid())).body.booking;
    expect((await a.post(`/api/bookings/${booking.id}/confirm`)).status).toBe(403);
    expect((await a.post(`/api/bookings/${booking.id}/decline`)).status).toBe(403);
    const studio = await t.studio();
    expect((await studio.post('/api/bookings/9999/confirm')).status).toBe(404);
  });
});
