// Staff API: daily overview, reservation list, cancel, phone booking, spots out of use.
// Numbers are checked against the C# AI log where possible (e.g. 20 July 2027: 8 arrivals, 8/60 = 13 %).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('staff API', () => {
  let server;
  let cookie;
  const get = (path) => server.request(path, { cookie });
  const post = (path, body) => server.request(path, { method: 'POST', cookie, body });

  before(async () => {
    server = await startTestServer();
    cookie = await server.signIn();
  });
  after(() => server.close());

  describe('daily overview', () => {
    it('shows arrivals, departures and occupancy of a day', async () => {
      const { status, body } = await get('/api/admin/day/2027-07-20');
      assert.equal(status, 200);
      // Same as the C# AI log for this day: "8 aankomsten, 8/60 bezet (13%)".
      assert.deepEqual(body.stats, { date: '2027-07-20', checkIns: 8, checkOuts: 0, occupiedSpots: 8, totalSpots: 60, occupancyPercent: 13 });
      assert.deepEqual(body.arrivals.map((r) => r.spotName), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
      assert.equal(body.departures.length, 0);
    });

    it('lists who leaves, with phone numbers when known', async () => {
      const { body } = await get('/api/admin/day/2027-07-23');
      assert.equal(body.stats.checkOuts, 8);
      assert.equal(body.stats.checkIns, 6);
      const henk = (await get('/api/admin/day/2027-08-02')).body.arrivals[0];
      assert.equal(henk.guestName, 'Henk (vriend van Bert)');
      assert.equal(henk.phone, '0612345678');
      assert.equal(henk.isFriendOfBert, true);
    });

    it('gives the month calendar with numbers for all 60 spots', async () => {
      const { body } = await get('/api/admin/calendar?year=2027&month=7');
      const day = body.days.find((d) => d.date === '2027-07-20');
      assert.equal(day.totalSpots, 60);
      assert.equal(day.checkIns, 8);
    });
  });

  describe('reservation list', () => {
    it('searches on guest name or spot code, case-insensitive', async () => {
      assert.deepEqual((await get('/api/admin/reservations?search=VRIES')).body.reservations.map((r) => r.guestName), ['Familie De Vries']);
      assert.deepEqual((await get('/api/admin/reservations?search=C03')).body.reservations.map((r) => r.guestName), ['Testgast Lente']);
    });

    it('treats % and _ in the search text as normal characters', async () => {
      assert.equal((await get('/api/admin/reservations?search=%25')).body.reservations.length, 0);
      assert.equal((await get('/api/admin/reservations?search=_')).body.reservations.length, 0);
    });

    it('filters on period and status', async () => {
      const april = (await get('/api/admin/reservations?from=2027-04-01&to=2027-04-30')).body.reservations;
      assert.deepEqual(april.map((r) => r.guestName), ['Testgast Pasen', 'Testgast Lente']);
      assert.equal((await get('/api/admin/reservations?status=Cancelled')).body.reservations.length, 0);
      assert.equal((await get('/api/admin/reservations')).body.reservations.length, 20);
      assert.equal((await get('/api/admin/reservations?status=Maybe')).status, 400);
    });

    it('gives every column of the spreadsheet-like table', async () => {
      const [row] = (await get('/api/admin/reservations?search=Jansen')).body.reservations;
      assert.deepEqual(row, {
        id: 2, number: 'GW-00002', spotId: 41, spotName: 'C01', spotType: 'Camper', guestName: 'Jansen',
        start: '2027-07-14', end: '2027-07-17', nights: 3, status: 'Confirmed', phone: null, email: 'jansen@example.com',
        isFriendOfBert: false, paymentStatus: 'Paid', needsMove: false, createdBy: 'Guest', notes: null,
        totalPriceCents: 9000, createdAt: row.createdAt,
      });
    });

    it('cancels a reservation; the spot is free again for guests', async () => {
      const t03 = '/api/spots/3?start=2027-05-20&end=2027-05-22';
      const booked = await post('/api/admin/reservations', {
        type: 'TentCaravan', start: '2027-05-20', end: '2027-05-22', spotId: 3, guestName: 'Te Annuleren', guestPhone: '0612345678',
      });
      assert.equal((await server.request(t03)).status, 404);

      const { status, body } = await post(`/api/admin/reservations/${booked.body.reservation.id}/cancel`);
      assert.equal(status, 200);
      assert.equal(body.reservation.status, 'Cancelled');
      assert.equal((await server.request(t03)).status, 200);
      assert.equal((await post('/api/admin/reservations/9999/cancel')).status, 404);
    });
  });

  describe('phone booking', () => {
    beforeEach(() => { server.email.sent.length = 0; });

    it('can book a reserve tent for a friend of Bert without e-mail and without payment', async () => {
      const free = (await get('/api/admin/free-spots?type=TentCaravan&start=2027-06-01&end=2027-06-04')).body.spots;
      assert.deepEqual(free.filter((s) => s.isHeld).map((s) => s.name), ['T37', 'T38', 'T39', 'T40']);

      const { status, body } = await post('/api/admin/reservations', {
        type: 'TentCaravan', start: '2027-06-01', end: '2027-06-04', spotId: 38,
        guestName: 'Kees (vriend van Bert)', guestPhone: '06 98765432', isFriendOfBert: true, notes: 'Belt nog terug',
      });
      assert.equal(status, 201);
      assert.equal(body.emailSent, false);
      assert.equal(server.email.sent.length, 0);
      assert.equal(body.reservation.spotName, 'T38');
      assert.equal(body.reservation.createdBy, 'Staff');
      assert.equal(body.reservation.paymentStatus, 'Open');
      assert.equal(body.reservation.isFriendOfBert, true);
      assert.equal(body.reservation.totalPriceCents, 7500); // normal price (open question in the plan)
    });

    it('sends a confirmation when there is an e-mail address', async () => {
      const { body } = await post('/api/admin/reservations', {
        type: 'Camper', start: '2027-06-01', end: '2027-06-02', spotId: 45, guestName: 'Mail Gast', guestPhone: '0612345678', guestEmail: 'mail@example.com',
      });
      assert.equal(body.emailSent, true);
      assert.equal(server.email.sent.length, 1);
      assert.match(server.email.sent[0].text, /Status: nog te betalen/);
    });

    it('lists every problem in the form at once, in Dutch', async () => {
      const { status, body } = await post('/api/admin/reservations', { guestEmail: 'fout', notes: 'x'.repeat(1001) });
      assert.equal(status, 422);
      assert.deepEqual(body.error.fields, {
        type: 'Kies het type plek.',
        start: 'Kies een aankomstdatum in de kalender.',
        end: 'Kies een vertrekdatum in de kalender.',
        spotId: 'Kies een plek.',
        guestName: 'Vul de naam van de gast in.',
        guestPhone: 'Vul een telefoonnummer in.',
        guestEmail: 'Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl',
        notes: 'De opmerking is te lang (maximaal 1000 tekens).',
      });
    });

    it('cannot double-book: an occupied spot gives 409 spot_taken', async () => {
      const { status, body } = await post('/api/admin/reservations', {
        type: 'TentCaravan', start: '2027-07-14', end: '2027-07-16', spotId: 1, guestName: 'Dubbel', guestPhone: '0612345678',
      });
      assert.equal(status, 409);
      assert.equal(body.error.code, 'spot_taken');
    });

    it('counts reserve tents in the phone booking calendar', async () => {
      const { body } = await get('/api/admin/availability?type=TentCaravan&year=2027&month=6');
      assert.equal(body.days[0].totalSpots, 40);
      assert.equal((await get('/api/admin/availability/check?type=TentCaravan&start=2027-06-10&end=2027-06-12')).body.valid, true);
    });
  });

  describe('spots out of use', () => {
    it('shows all 60 spots in field order with their status on a day', async () => {
      const { body } = await get('/api/admin/spots?day=2027-07-14');
      assert.equal(body.spots.length, 60);
      assert.deepEqual([body.spots[0].name, body.spots[40].name, body.spots[52].name], ['T01', 'C01', 'S1']);
      const t01 = body.spots[0];
      assert.equal(t01.status, 'Reserved');
      assert.equal(t01.reservedBy, 'Familie De Vries');
      assert.equal(body.spots.find((s) => s.name === 'T37').status, 'Held');
    });

    it('taking T01 out of use flags its guests and hides it from guests; turning it on again undoes that', async () => {
      const off = await post('/api/admin/spots/1/unavailable', { reason: 'Accident' });
      assert.deepEqual(off.body, { spots: 1, needsMove: 1 });
      assert.deepEqual((await get('/api/admin/needs-move')).body.reservations.map((r) => r.guestName), ['Familie De Vries']);
      const t01 = (await get('/api/admin/spots?day=2027-07-14')).body.spots[0];
      assert.equal(t01.status, 'Unavailable');
      assert.equal(t01.unavailableReason, 'Accident');
      assert.equal((await server.request('/api/spots/1?start=2027-05-01&end=2027-05-02')).status, 404);

      const on = await post('/api/admin/spots/1/available');
      assert.deepEqual(on.body, { spots: 1 });
      assert.equal((await get('/api/admin/needs-move')).body.reservations.length, 0);
      assert.equal((await server.request('/api/spots/1?start=2027-05-01&end=2027-05-02')).status, 200);
    });

    it('taking the whole Safariveld out of use flags all 15 safari reservations (as in the C# test)', async () => {
      const { body } = await post('/api/admin/fields/Safariveld/unavailable', { reason: 'WetSeason' });
      assert.deepEqual(body, { spots: 8, needsMove: 15 });
      assert.equal((await server.request('/api/spot-types')).body.spotTypes.some((t) => t.type === 'Safari'), false);
      await post('/api/admin/fields/Safariveld/available');
      assert.equal((await get('/api/admin/needs-move')).body.reservations.length, 0);
    });

    it('needs a valid reason and an existing spot or field', async () => {
      assert.equal((await post('/api/admin/spots/1/unavailable', { reason: 'Zomaar' })).status, 422);
      assert.equal((await post('/api/admin/spots/999/unavailable', { reason: 'Accident' })).status, 404);
      assert.equal((await post('/api/admin/fields/Maanveld/unavailable', { reason: 'Accident' })).status, 404);
    });
  });
});
