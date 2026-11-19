// The staff AI endpoints: the forecast through the fake AI service, a calm 503 when the AI service
// is off or broken, only anonymous numbers sent, and booking that keeps working without AI.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createAiClient } from '../src/ai/ai-client.js';
import { createMockAiService } from '../src/ai/mock-ai-service.js';
import { HISTORY_DAYS, buildOccupancyHistory } from '../src/modules/ai/ai.service.js';
import { getSettings } from '../src/modules/settings/settings.service.js';
import { createSilentLogger, createTestDatabase, guestBooking, startTestServer } from './helpers.js';

const KEY = 'test-key-0123456789abcdef';

describe('staff AI endpoints', () => {
  let mock;
  let server;
  let cookie;
  const get = (path) => server.request(path, { cookie });

  before(async () => {
    mock = createMockAiService({ key: KEY, delayMs: 1000 });
    const url = await mock.listen();
    const logger = createSilentLogger();
    server = await startTestServer({ logger, ai: createAiClient({ url, key: KEY, timeoutMs: 300 }, { logger }) });
    cookie = await server.signIn();
  });
  after(async () => {
    await server.close();
    await mock.close();
  });
  beforeEach(() => {
    mock.setMode('ok');
    mock.requests.length = 0;
  });

  it('needs a signed-in staff member', async () => {
    assert.equal((await server.request('/api/admin/ai/occupancy-forecast?from=2027-08-01&to=2027-08-07')).status, 401);
    assert.equal((await server.request('/api/admin/ai/status')).status, 401);
    assert.equal(mock.requests.length, 0);
  });

  it('gives the forecast for a period, built from last year without any personal data', async () => {
    const { status, body } = await get('/api/admin/ai/occupancy-forecast?from=2028-07-01&to=2028-07-07');
    assert.equal(status, 200);
    assert.equal(body.from, '2028-07-01');
    assert.equal(body.forecast.length, 7 * 3);

    const sent = mock.requests[0].body;
    for (const row of sent.history) assert.deepEqual(Object.keys(row), ['date', 'spotType', 'occupied', 'total']);
    const text = JSON.stringify(sent);
    for (const personal of ['Vries', 'example.com', '0612345678', 'GW-']) assert.ok(!text.includes(personal), `${personal} was sent`);
    // 20 July 2027 in the seed: all 8 safari tents taken.
    assert.deepEqual(sent.history.find((r) => r.date === '2027-07-20' && r.spotType === 'Safari'), { date: '2027-07-20', spotType: 'Safari', occupied: 8, total: 8 });
  });

  it('answers 503 ai_unavailable with a Dutch message when the AI service fails', async () => {
    for (const mode of ['error', 'unavailable', 'bad', 'slow']) {
      mock.setMode(mode);
      const { status, body } = await get('/api/admin/ai/occupancy-forecast?from=2027-08-01&to=2027-08-07');
      assert.equal(status, 503, mode);
      assert.equal(body.error.code, 'ai_unavailable');
      assert.match(body.error.message, /niet beschikbaar/);
    }
  });

  it('checks the period before asking the AI service', async () => {
    assert.equal((await get('/api/admin/ai/occupancy-forecast?from=2027-08-07&to=2027-08-01')).status, 400);
    assert.equal((await get('/api/admin/ai/occupancy-forecast?from=2027-08-01&to=2027-11-02')).status, 400); // 94 days
    assert.equal((await get('/api/admin/ai/occupancy-forecast?from=2027-08-01&to=2027-11-01')).status, 200); // 93 days
    assert.equal((await get('/api/admin/ai/occupancy-forecast?from=morgen&to=2027-08-01')).status, 400);
    assert.equal(mock.requests.length, 1);
  });

  it('tells whether the AI service is available', async () => {
    assert.deepEqual((await get('/api/admin/ai/status')).body, { configured: true, available: true });
    mock.setMode('unavailable');
    assert.deepEqual((await get('/api/admin/ai/status')).body, { configured: true, available: false });
  });
});

describe('without an AI service', () => {
  let server;
  before(async () => { server = await startTestServer(); }); // the test settings have no AI_SERVICE_URL
  after(() => server.close());

  it('answers 503 for AI features, while booking and paying work as always', async () => {
    const cookie = await server.signIn();
    assert.deepEqual((await server.request('/api/admin/ai/status', { cookie })).body, { configured: false, available: false });
    const forecast = await server.request('/api/admin/ai/occupancy-forecast?from=2027-08-01&to=2027-08-07', { cookie });
    assert.equal(forecast.status, 503);
    assert.equal(forecast.body.error.code, 'ai_unavailable');

    const created = await server.request('/api/reservations', { method: 'POST', body: guestBooking() });
    assert.equal(created.status, 201);
    const paid = await server.request(`/api/reservations/${created.body.reservation.id}/payment`, { method: 'POST', body: { bookingToken: created.body.bookingToken } });
    assert.equal(paid.body.reservation.paymentStatus, 'Paid');
  });
});

describe('occupancy history', () => {
  it('covers the open days of the year before, three types per day, never more than occupied ≤ total', () => {
    const db = createTestDatabase({ seed: true });
    const history = buildOccupancyHistory(db, { from: '2027-11-01', settings: getSettings(db) });
    const days = new Set(history.map((row) => row.date));
    assert.equal(days.size, 214); // 1 April – 31 October 2027
    assert.equal(history.length, days.size * 3);
    assert.ok(history.every((row) => row.occupied >= 0 && row.occupied <= row.total));
    assert.ok(!days.has('2027-03-31') && !days.has('2027-11-01'));
    assert.ok(HISTORY_DAYS === 365);
    db.close();
  });

  it('does not count cancelled reservations', () => {
    const db = createTestDatabase({ seed: true });
    const before = buildOccupancyHistory(db, { from: '2028-04-01', settings: getSettings(db) }).find((r) => r.date === '2027-07-20' && r.spotType === 'Safari');
    db.prepare("UPDATE reservations SET status = 'Cancelled' WHERE spot_id = (SELECT id FROM spots WHERE name = 'S1')").run();
    const afterCancel = buildOccupancyHistory(db, { from: '2028-04-01', settings: getSettings(db) }).find((r) => r.date === '2027-07-20' && r.spotType === 'Safari');
    assert.equal(before.occupied - afterCancel.occupied, 1);
    db.close();
  });
});
