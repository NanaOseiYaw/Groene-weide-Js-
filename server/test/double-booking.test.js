// Business rule 4: a spot can never be booked twice for the same night.
// JavaScript port of "dotnet run -- test-double-booking" from the C# project, as automated tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Worker } from 'node:worker_threads';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { guestBooking, startTestServer } from './helpers.js';

const confirmedOverlaps = (db) => db.prepare(`
  SELECT COUNT(*) FROM reservations a JOIN reservations b
    ON a.spot_id = b.spot_id AND a.id < b.id AND a.start_date < b.end_date AND a.end_date > b.start_date
   WHERE a.status = 'Confirmed' AND b.status = 'Confirmed'`).pluck().get();

describe('double bookings through the API', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  const post = (overrides) => server.request('/api/reservations', { method: 'POST', body: guestBooking(overrides) });

  it('10 guests booking the same camper spot at the same moment: 1 succeeds, 9 get spot_taken', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => post({ start: '2027-06-14', end: '2027-06-17' })));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409 && r.body.error.code === 'spot_taken').length, 9);
  });

  it('a period that overlaps by one night is refused as well', async () => {
    const results = await Promise.all([post({ start: '2027-06-20', end: '2027-06-23' }), post({ start: '2027-06-22', end: '2027-06-24' })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });

  it('the departure day is free for the next guest', async () => {
    assert.equal((await post({ start: '2027-06-26', end: '2027-06-28' })).status, 201);
    assert.equal((await post({ start: '2027-06-28', end: '2027-06-30' })).status, 201);
  });

  it('leaves no overlapping confirmed reservations in the database', () => {
    assert.equal(confirmedOverlaps(server.db), 0);
  });
});

describe('double bookings from separate database connections (like two server processes)', () => {
  let folder;
  let file;
  before(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'groene-weide-test-'));
    file = path.join(folder, 'test.db');
    const db = openDatabase(file);
    migrate(db);
    seedDatabase(db);
    db.close();
  });
  after(() => fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  /** Starts `count` workers that all try the same booking at once; returns their results. */
  async function bookAtOnce(count, booking, isStaff = () => false) {
    const startSignal = new SharedArrayBuffer(4);
    const workerUrl = new URL('./support/booking-worker.js', import.meta.url);
    const workers = Array.from({ length: count }, (_, i) => new Worker(workerUrl, {
      workerData: { file, startSignal, booking, forStaff: isStaff(i), guestName: `Worker ${i}` },
    }));
    const ready = workers.map((worker) => new Promise((resolve) => worker.once('message', resolve)));
    const results = workers.map((worker) => new Promise((resolve, reject) => {
      worker.on('message', (message) => { if (!message.ready) resolve(message); });
      worker.once('error', reject);
    }));
    await Promise.all(ready);
    const signal = new Int32Array(startSignal);
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    return Promise.all(results);
  }

  it('10 guests at once on the same spot and nights: exactly 1 succeeds', async () => {
    const results = await bookAtOnce(10, { spotId: 41, spotType: 'Camper', start: '2027-08-10', end: '2027-08-13' });
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.ok(results.filter((r) => !r.ok).every((r) => r.code === 'spot_taken'), JSON.stringify(results));
  });

  it('5 guests and 5 staff members mixed: exactly 1 succeeds', async () => {
    const results = await bookAtOnce(10, { spotId: 42, spotType: 'Camper', start: '2027-08-10', end: '2027-08-13' }, (i) => i % 2 === 0);
    assert.equal(results.filter((r) => r.ok).length, 1);
  });

  it('leaves no overlapping confirmed reservations in the database file', () => {
    const db = openDatabase(file);
    try {
      assert.equal(confirmedOverlaps(db), 0);
    } finally {
      db.close();
    }
  });
});
