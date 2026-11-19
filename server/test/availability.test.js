// The colourful calendar and the period check, against the seed data
// (all 8 safari tents full 20–22 July 2027, 6 of 8 occupied 23–25 July, deal days 13–14 April).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { getMonth, validatePeriod } from '../src/modules/availability/availability.service.js';
import { getSettings } from '../src/modules/settings/settings.service.js';
import { createTestDatabase, startTestServer, TEST_TODAY } from './helpers.js';

const byDate = (days) => Object.fromEntries(days.map((day) => [day.date, day]));

describe('calendar month', () => {
  const db = createTestDatabase({ seed: true });
  const settings = getSettings(db);
  const month = (options) => byDate(getMonth(db, { today: TEST_TODAY, settings, ...options }));

  it('shows full and almost full safari days with text, not only colour', () => {
    const july = month({ type: 'Safari', year: 2027, month: 7 });
    assert.equal(july['2027-07-19'].status, 'Free');
    for (const date of ['2027-07-20', '2027-07-21', '2027-07-22']) {
      assert.equal(july[date].status, 'Full');
      assert.equal(july[date].label, 'vol');
      assert.equal(july[date].selectable, false);
      assert.equal(july[date].onlyDeparture, true); // a full day can still be a departure day
    }
    assert.equal(july['2027-07-23'].status, 'AlmostFull');
    assert.equal(july['2027-07-23'].label, 'nog 2 plekken');
    assert.equal(july['2027-07-23'].freeSpots, 2);
    assert.equal(july['2027-07-26'].status, 'Free');
  });

  it('counts only bookable spots for guests (reserve tents excluded)', () => {
    const july = month({ type: 'TentCaravan', year: 2027, month: 7 });
    assert.equal(july['2027-07-01'].totalSpots, 36);
    assert.equal(july['2027-07-14'].freeSpots, 35); // T01 is occupied
    const withHeld = month({ type: 'TentCaravan', year: 2027, month: 7, includeHeld: true });
    assert.equal(withHeld['2027-07-01'].totalSpots, 40);
  });

  it('marks deal days in blue with the discounted price', () => {
    const april = month({ type: 'Camper', year: 2027, month: 4 });
    assert.equal(april['2027-04-13'].status, 'Deal');
    assert.equal(april['2027-04-13'].label, 'deal');
    assert.equal(april['2027-04-13'].pricePerNightCents, 2400);
    assert.equal(april['2027-04-13'].discountPercentage, 20);
    assert.equal(april['2027-04-12'].pricePerNightCents, 3000);
  });

  it('shows the deal price on an almost full deal day as well (the price the guest pays)', () => {
    db.prepare("INSERT INTO deal_days (deal_date, spot_type, discount_percentage) VALUES ('2027-07-24', 'Safari', 10)").run();
    const day = month({ type: 'Safari', year: 2027, month: 7 })['2027-07-24'];
    assert.equal(day.status, 'AlmostFull');
    assert.equal(day.pricePerNightCents, 6750);
    assert.equal(day.discountPercentage, 10);
  });

  it('is closed outside the season, and 31 October is a departure day only', () => {
    const november = month({ type: 'Camper', year: 2027, month: 11 });
    assert.ok(Object.values(november).every((day) => day.status === 'Closed' && day.label === 'gesloten' && !day.selectable));
    const october = month({ type: 'Camper', year: 2027, month: 10 });
    assert.equal(october['2027-10-31'].selectable, false);
    assert.equal(october['2027-10-31'].onlyDeparture, true);
    assert.equal(october['2027-10-30'].selectable, true);
  });

  it('marks days before today as past', () => {
    const july = byDate(getMonth(db, { type: 'Camper', year: 2027, month: 7, today: '2027-07-15', settings }));
    assert.equal(july['2027-07-14'].isPast, true);
    assert.equal(july['2027-07-14'].label, 'voorbij');
    assert.equal(july['2027-07-14'].selectable, false);
    assert.equal(july['2027-07-15'].selectable, true);
  });

  it('staff view: all 60 spots with arrivals and departures, without deals', () => {
    const july = byDate(getMonth(db, { type: null, year: 2027, month: 7, today: TEST_TODAY, settings, staffView: true }));
    assert.equal(july['2027-07-20'].totalSpots, 60);
    assert.equal(july['2027-07-20'].checkIns, 8);
    assert.equal(july['2027-07-23'].checkOuts, 8);
    assert.equal(july['2027-07-23'].checkIns, 6);
  });
});

describe('period check', () => {
  const db = createTestDatabase({ seed: true });
  const settings = getSettings(db);
  const check = (type, start, end, today = TEST_TODAY) => validatePeriod(db, { type, start, end, today, settings });

  it('accepts a period with one spot free for every night', () => {
    assert.deepEqual(check('Safari', '2027-07-17', '2027-07-20'), { valid: true, message: null, alternatives: [] });
  });

  it('names the full nights and offers the 3 closest periods of the same length', () => {
    const result = check('Safari', '2027-07-19', '2027-07-21');
    assert.equal(result.valid, false);
    assert.equal(result.message, 'Op 20 juli is alles vol. Deze periodes van dezelfde lengte zijn wel vrij:');
    assert.deepEqual(result.alternatives, [
      { start: '2027-07-18', end: '2027-07-20', nights: 2 },
      { start: '2027-07-17', end: '2027-07-19', nights: 2 },
      { start: '2027-07-16', end: '2027-07-18', nights: 2 },
    ]);
  });

  it('refuses a period where every night has a free tent, but no single tent is free the whole time', () => {
    // 23–25 July only S7 and S8 are free. Make S7 busy on the 24th and S8 on the 23rd:
    // each night one tent is free, but a guest stays on ONE spot, so 23–25 is not possible.
    const fresh = createTestDatabase({ seed: true });
    const insert = fresh.prepare("INSERT INTO reservations (spot_id, start_date, end_date, guest_name) VALUES ((SELECT id FROM spots WHERE name = ?), ?, ?, 'Test')");
    insert.run('S7', '2027-07-24', '2027-07-26');
    insert.run('S8', '2027-07-23', '2027-07-24');
    const result = validatePeriod(fresh, { type: 'Safari', start: '2027-07-23', end: '2027-07-25', today: TEST_TODAY, settings });
    assert.equal(result.valid, false);
    assert.match(result.message, /^Er is geen plek die de hele periode vrij is\./);
  });

  it('explains wrong dates in Dutch', () => {
    assert.equal(check('Camper', '2027-07-14', '2027-07-14').message, 'De vertrekdatum moet na de aankomstdatum liggen.');
    assert.equal(check('Camper', '2027-07-14', '2027-07-16', '2027-07-15').message, 'Deze aankomstdatum is al voorbij. Kies een datum vanaf vandaag.');
    const outOfSeason = 'De camping is open van 1 april t/m 31 oktober. Kies datums binnen die periode.';
    assert.equal(check('Camper', '2027-03-30', '2027-04-02').message, outOfSeason);
    assert.equal(check('Camper', '2027-10-30', '2028-04-02').message, outOfSeason); // through the winter
  });
});

describe('GET /api/availability and /api/campsite', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  it('returns every day of the month', async () => {
    const { status, body } = await server.request('/api/availability?type=Safari&year=2027&month=7');
    assert.equal(status, 200);
    assert.equal(body.days.length, 31);
    assert.equal(body.days[19].label, 'vol');
    assert.equal(body.days[0].checkIns, undefined); // staff numbers are not shown to guests
  });

  it('rejects a wrong type or month with 400', async () => {
    assert.equal((await server.request('/api/availability?type=Boot&year=2027&month=7')).status, 400);
    const { status, body } = await server.request('/api/availability?type=Camper&year=2027&month=13');
    assert.equal(status, 400);
    assert.equal(body.error.code, 'invalid_request');
  });

  it('checks a period', async () => {
    const { body } = await server.request('/api/availability/check?type=Safari&start=2027-07-19&end=2027-07-21');
    assert.equal(body.valid, false);
    assert.equal(body.alternatives.length, 3);
  });

  it('gives the campsite details, the season and the server\'s "today"', async () => {
    const { body } = await server.request('/api/campsite');
    assert.equal(body.name, 'Camping De Groene Weide');
    assert.deepEqual(body.season, { start: '04-01', end: '10-31', text: '1 april t/m 31 oktober' });
    assert.equal(body.today, TEST_TODAY);
    assert.equal(body.firstOpenDay, '2027-04-01');
  });
});
