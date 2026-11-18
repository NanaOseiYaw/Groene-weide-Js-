// Spot types, the spot list (step 5) and the spot pop-up.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('spots API', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  const spotNames = async (query) => (await server.request(`/api/spots?${query}`)).body.spots.map((spot) => spot.name);

  it('lists the three spot types with their lowest price', async () => {
    const { body } = await server.request('/api/spot-types');
    assert.deepEqual(body.spotTypes, [
      { type: 'TentCaravan', label: 'Tent of caravan', fieldName: 'Kampeerveld', pricePerNightCents: 2500 },
      { type: 'Camper', label: 'Camper', fieldName: 'Camperveld', pricePerNightCents: 3000 },
      { type: 'Safari', label: 'Safaritent', fieldName: 'Safariveld', pricePerNightCents: 7500 },
    ]);
  });

  it('never shows occupied spots or reserve tents to guests', async () => {
    const names = await spotNames('type=TentCaravan&start=2027-07-14&end=2027-07-16');
    assert.equal(names.length, 35);
    assert.ok(!names.includes('T01')); // occupied 12–19 July
    assert.ok(!names.some((name) => ['T37', 'T38', 'T39', 'T40'].includes(name)));
  });

  it('shows a spot again from its previous guest\'s departure day', async () => {
    assert.ok((await spotNames('type=TentCaravan&start=2027-07-19&end=2027-07-21')).includes('T01'));
  });

  it('hides a spot that staff took out of use, without telling guests why', async () => {
    server.db.prepare("UPDATE spots SET is_available = 0, unavailable_reason = 'Accident' WHERE name = 'T04'").run();
    try {
      const { body } = await server.request('/api/spots?type=TentCaravan&start=2027-05-01&end=2027-05-03');
      assert.ok(!body.spots.some((spot) => spot.name === 'T04'));
      assert.ok(!JSON.stringify(body).includes('Accident'));
    } finally {
      server.db.prepare("UPDATE spots SET is_available = 1, unavailable_reason = NULL WHERE name = 'T04'").run();
    }
  });

  it('gives the first real photo, never a seed placeholder', async () => {
    server.db.prepare("INSERT INTO spot_photos (spot_id, filename, alt_text, sort_order) VALUES (42, 'abc.webp', 'Camperplek C02 met grindstrook', 1)").run();
    const { body } = await server.request('/api/spots?type=Camper&start=2027-05-01&end=2027-05-03');
    const c01 = body.spots.find((spot) => spot.name === 'C01');
    const c02 = body.spots.find((spot) => spot.name === 'C02');
    assert.equal(c01.firstPhoto, null); // only a placeholder row: the guest sees "Foto volgt"
    assert.deepEqual(c02.firstPhoto, { id: c02.firstPhoto.id, url: '/uploads/spots/abc.webp', altText: 'Camperplek C02 met grindstrook' });
    assert.deepEqual(c01.amenities, ['stroom', 'water']);
  });

  it('gives the details of a spot with the total price, deal days included', async () => {
    // C01 (id 41), 12–15 April 2027: € 30 + € 24 (deal) + € 24 (deal)
    const { status, body } = await server.request('/api/spots/41?start=2027-04-12&end=2027-04-15');
    assert.equal(status, 200);
    assert.equal(body.spot.name, 'C01');
    assert.equal(body.spot.nights, 3);
    assert.equal(body.spot.totalPriceCents, 7800);
    assert.deepEqual(body.spot.photos, []);
  });

  it('answers 404 spot_unavailable for a spot that is taken in the period', async () => {
    const { status, body } = await server.request('/api/spots/1?start=2027-07-14&end=2027-07-16'); // T01
    assert.equal(status, 404);
    assert.equal(body.error.code, 'spot_unavailable');
    assert.equal((await server.request('/api/spots/37?start=2027-05-01&end=2027-05-02')).status, 404); // reserve tent
  });

  it('rejects wrong query parameters with 400', async () => {
    assert.equal((await server.request('/api/spots?type=Camper&start=2027-05-03&end=2027-05-01')).status, 400);
    assert.equal((await server.request('/api/spots?type=Camper&start=gisteren&end=2027-05-01')).status, 400);
    assert.equal((await server.request('/api/spots/abc?start=2027-05-01&end=2027-05-02')).status, 400);
  });
});
