// Guest booking (step 6), payment and the confirmation e-mail.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { guestBooking, startTestServer } from './helpers.js';

/** Creates a reservation and returns the response body ({ reservation, bookingToken }). */
async function book(server, overrides) {
  const { status, body } = await server.request('/api/reservations', { method: 'POST', body: guestBooking(overrides) });
  assert.equal(status, 201, JSON.stringify(body));
  return body;
}

const pay = (server, id, bookingToken) =>
  server.request(`/api/reservations/${id}/payment`, { method: 'POST', body: { bookingToken } });

describe('guest booking: the happy path', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  it('stores the reservation with an open payment and a server-side price', async () => {
    const { reservation, bookingToken } = await book(server, { totalPriceCents: 1 }); // a price from the browser is ignored
    assert.equal(reservation.number, 'GW-00021'); // 20 seed reservations come first
    assert.equal(reservation.status, 'Confirmed');
    assert.equal(reservation.paymentStatus, 'Open');
    assert.deepEqual(reservation.spot, { id: 41, name: 'C01', type: 'Camper', fieldName: 'Camperveld' });
    assert.equal(reservation.nights, 3);
    assert.equal(reservation.totalPriceCents, 9000);
    assert.equal(typeof bookingToken, 'string');

    const stored = server.db.prepare('SELECT booking_token_hash, created_by FROM reservations WHERE id = ?').get(reservation.id);
    assert.equal(stored.created_by, 'Guest');
    assert.notEqual(stored.booking_token_hash, bookingToken); // only a hash is stored
  });

  it('pays, marks the reservation as paid and e-mails the guest an invoice', async () => {
    const { reservation, bookingToken } = await book(server, { start: '2027-06-01', end: '2027-06-03' });
    const { status, body } = await pay(server, reservation.id, bookingToken);
    assert.equal(status, 200);
    assert.equal(body.reservation.paymentStatus, 'Paid');

    const mail = server.email.sent.at(-1);
    assert.equal(mail.to, 'gast@example.com');
    assert.equal(mail.subject, `Bevestiging reservering ${reservation.number}`);
    assert.match(mail.text, /Plek:\s+C01 \(Camper, Camperveld\)/);
    assert.match(mail.text, /Aankomst:\s+dinsdag 1 juni 2027/);
    assert.match(mail.text, /Totaal \(2 nachten\)\s+€ 60/);
    assert.match(mail.text, /Status: betaald/);
  });

  it('keeps the own tent or caravan as a note and shows deal discounts on the invoice', async () => {
    // T06 (id 6), 12–15 April 2027: € 25 + € 20 (deal) + € 20 (deal)
    const { reservation, bookingToken } = await book(server, { spotId: 6, type: 'TentCaravan', equipment: 'OwnCaravan', start: '2027-04-12', end: '2027-04-15' });
    assert.equal(reservation.totalPriceCents, 6500);
    assert.equal(reservation.notes, 'Eigen caravan');
    await pay(server, reservation.id, bookingToken);
    const mail = server.email.sent.at(-1);
    assert.match(mail.text, /Opmerking:\s+Eigen caravan/);
    assert.match(mail.text, /Nacht 13 april 2027\s+€ 20 {2}\(deal 20% korting\)/);
  });

  it('paying twice is harmless: still paid, only one e-mail', async () => {
    const { reservation, bookingToken } = await book(server, { start: '2027-06-10', end: '2027-06-11' });
    await pay(server, reservation.id, bookingToken);
    const mailsBefore = server.email.sent.length;
    const second = await pay(server, reservation.id, bookingToken);
    assert.equal(second.status, 200);
    assert.equal(second.body.reservation.paymentStatus, 'Paid');
    assert.equal(server.email.sent.length, mailsBefore);
  });
});

describe('guest booking: input checks', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  const post = (body) => server.request('/api/reservations', { method: 'POST', body });

  it('asks the guest to go back when a choice is missing', async () => {
    const { status, body } = await post(guestBooking({ spotId: undefined }));
    assert.equal(status, 422);
    assert.equal(body.error.code, 'missing_choice');
    assert.equal((await post(guestBooking({ start: '2027-02-30' }))).body.error.code, 'missing_choice');
  });

  it('requires own tent or caravan for the Kampeerveld', async () => {
    const { status, body } = await post(guestBooking({ spotId: 6, type: 'TentCaravan' }));
    assert.equal(status, 422);
    assert.equal(body.error.message, 'Kies eerst of je een eigen tent of een eigen caravan meeneemt.');
  });

  it('gives a Dutch message per guest field', async () => {
    const { status, body } = await post(guestBooking({ guest: { name: ' ', email: 'naam@', phone: '123' } }));
    assert.equal(status, 422);
    assert.equal(body.error.code, 'validation_failed');
    assert.deepEqual(body.error.fields, {
      name: 'Vul je naam in.',
      email: 'Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl',
      phone: 'Dit telefoonnummer klopt niet. Bijvoorbeeld: 06 12345678',
    });
    const empty = await post(guestBooking({ guest: {} }));
    assert.deepEqual(Object.keys(empty.body.error.fields), ['name', 'email', 'phone']);
  });

  it('accepts phone numbers with spaces, dashes and a country code', async () => {
    const stays = [['06-12345678', '2027-09-10', '2027-09-11'], ['+31 6 12345678', '2027-09-11', '2027-09-12'], ['012 345 67 89', '2027-09-12', '2027-09-13']];
    for (const [phone, start, end] of stays) {
      const { status } = await post(guestBooking({ start, end, guest: { name: 'A', email: 'a@b.nl', phone } }));
      assert.equal(status, 201, phone);
    }
  });

  it('refuses past dates and dates outside the season', async () => {
    const past = await post(guestBooking({ start: '2027-01-10', end: '2027-01-12' }));
    assert.equal(past.status, 422);
    assert.equal(past.body.error.code, 'invalid_period');
    const winter = await post(guestBooking({ start: '2027-10-30', end: '2027-11-02' }));
    assert.equal(winter.body.error.message, 'De camping is open van 1 april t/m 31 oktober. Kies datums binnen die periode.');
  });

  it('refuses occupied spots, reserve tents, spots out of use and the wrong type with 409 spot_taken', async () => {
    const occupied = await post(guestBooking({ spotId: 1, type: 'TentCaravan', equipment: 'OwnTent', start: '2027-07-14', end: '2027-07-16' }));
    assert.equal(occupied.status, 409);
    assert.equal(occupied.body.error.code, 'spot_taken');

    const held = await post(guestBooking({ spotId: 37, type: 'TentCaravan', equipment: 'OwnTent' }));
    assert.equal(held.status, 409);

    server.db.prepare("UPDATE spots SET is_available = 0, unavailable_reason = 'Maintenance' WHERE id = 42").run();
    assert.equal((await post(guestBooking({ spotId: 42 }))).status, 409);

    assert.equal((await post(guestBooking({ spotId: 41, type: 'Safari' }))).status, 409);
  });
});

describe('guest booking: payment problems', () => {
  it('refuses to pay without the right booking token, and does not reveal which ids exist', async () => {
    const server = await startTestServer();
    try {
      const { reservation, bookingToken } = await book(server);
      for (const attempt of [await pay(server, reservation.id, 'wrong'), await pay(server, reservation.id, undefined), await pay(server, 9999, bookingToken)]) {
        assert.equal(attempt.status, 404);
        assert.equal(attempt.body.error.code, 'not_found');
      }
      // A seed reservation has no token at all.
      assert.equal((await pay(server, 1, bookingToken)).status, 404);
    } finally {
      await server.close();
    }
  });

  it('cancels the reservation when the payment fails, so the spot is free again', async () => {
    const server = await startTestServer({ payment: { pay: async () => ({ success: false }) } });
    try {
      const { reservation, bookingToken } = await book(server);
      const { status, body } = await pay(server, reservation.id, bookingToken);
      assert.equal(status, 402);
      assert.equal(body.error.code, 'payment_failed');
      assert.equal(server.db.prepare('SELECT status FROM reservations WHERE id = ?').pluck().get(reservation.id), 'Cancelled');
      assert.equal(server.email.sent.length, 0);

      await book(server); // the same spot and dates can be booked again
      const retry = await pay(server, reservation.id, bookingToken);
      assert.equal(retry.status, 409);
      assert.equal(retry.body.error.code, 'reservation_cancelled');
    } finally {
      await server.close();
    }
  });

  it('treats a payment service that crashes as a failed payment and logs it', async () => {
    const server = await startTestServer({ payment: { pay: async () => { throw new Error('provider down'); } } });
    try {
      const { reservation, bookingToken } = await book(server);
      assert.equal((await pay(server, reservation.id, bookingToken)).status, 402);
      assert.equal(server.logger.errors.length, 1);
    } finally {
      await server.close();
    }
  });

  it('refuses a second payment while the first is still running (double click)', async () => {
    const slowPayment = { pay: () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)) };
    const server = await startTestServer({ payment: slowPayment });
    try {
      const { reservation, bookingToken } = await book(server);
      const results = await Promise.all([pay(server, reservation.id, bookingToken), pay(server, reservation.id, bookingToken)]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(results.find((r) => r.status === 409).body.error.code, 'payment_in_progress');
      assert.equal(server.email.sent.length, 1);
    } finally {
      await server.close();
    }
  });

  it('still confirms the payment when the e-mail cannot be sent', async () => {
    const server = await startTestServer({ email: { send: async () => { throw new Error('mail server down'); } } });
    try {
      const { reservation, bookingToken } = await book(server);
      const { status, body } = await pay(server, reservation.id, bookingToken);
      assert.equal(status, 200);
      assert.equal(body.reservation.paymentStatus, 'Paid');
      assert.equal(server.logger.errors.length, 1);
    } finally {
      await server.close();
    }
  });
});
