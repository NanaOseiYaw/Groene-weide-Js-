import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { createTestDatabase } from './helpers.js';

const count = (db, sql, ...params) => db.prepare(sql).pluck().get(...params);

describe('migrations', () => {
  it('creates every table of the data model', () => {
    const db = createTestDatabase();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
    for (const table of ['spots', 'spot_photos', 'reservations', 'deal_days', 'settings', 'discount_codes', 'schema_migrations']) {
      assert.ok(tables.includes(table), `table ${table} is missing`);
    }
  });

  it('does nothing when the database is already up to date', () => {
    const db = createTestDatabase();
    assert.deepEqual(migrate(db), []);
  });
});

describe('seed', () => {
  it('adds 60 spots: 40 tent/caravan, 12 camper, 8 safari', () => {
    const db = createTestDatabase({ seed: true });
    assert.equal(count(db, 'SELECT COUNT(*) FROM spots'), 60);
    const perType = Object.fromEntries(db.prepare('SELECT type, COUNT(*) AS n FROM spots GROUP BY type').raw().all());
    assert.deepEqual(perType, { Camper: 12, Safari: 8, TentCaravan: 40 });
  });

  it('holds T37–T40 as reserve tents, so 56 spots are bookable', () => {
    const db = createTestDatabase({ seed: true });
    const held = db.prepare('SELECT name FROM spots WHERE is_held = 1 ORDER BY name').pluck().all();
    assert.deepEqual(held, ['T37', 'T38', 'T39', 'T40']);
    assert.equal(count(db, 'SELECT COUNT(*) FROM spots WHERE is_available = 1 AND is_held = 0'), 56);
  });

  it('stores prices in cents and amenities as a JSON list', () => {
    const db = createTestDatabase({ seed: true });
    const prices = Object.fromEntries(db.prepare('SELECT type, MIN(price_per_night_cents) FROM spots GROUP BY type').raw().all());
    assert.deepEqual(prices, { Camper: 3000, Safari: 7500, TentCaravan: 2500 });
    const t06 = db.prepare("SELECT amenities, distance_pool_m FROM spots WHERE name = 'T06'").get();
    assert.deepEqual(JSON.parse(t06.amenities), ['water', 'stroom', 'schaduw']);
    assert.equal(t06.distance_pool_m, 146); // same as schema.sql
  });

  it('adds the settings, deal days, placeholder photos and test reservations', () => {
    const db = createTestDatabase({ seed: true });
    const settings = Object.fromEntries(db.prepare('SELECT setting_key, setting_value FROM settings').raw().all());
    assert.deepEqual(settings, { almost_full_threshold: '3', season_start: '04-01', season_end: '10-31' });
    assert.equal(count(db, 'SELECT COUNT(*) FROM deal_days'), 3);
    assert.equal(count(db, "SELECT COUNT(*) FROM spot_photos WHERE filename LIKE 'placeholder_%'"), 5);
    assert.equal(count(db, 'SELECT COUNT(*) FROM reservations'), 20);
    assert.equal(count(db, "SELECT COUNT(*) FROM reservations WHERE start_date <= '2027-07-20' AND end_date > '2027-07-20' AND spot_id IN (SELECT id FROM spots WHERE type = 'Safari')"), 8);
  });

  it('has no two confirmed reservations on the same spot and night', () => {
    const db = createTestDatabase({ seed: true });
    const overlaps = count(db, `
      SELECT COUNT(*) FROM reservations a JOIN reservations b
        ON a.spot_id = b.spot_id AND a.id < b.id
       AND a.start_date < b.end_date AND a.end_date > b.start_date
     WHERE a.status = 'Confirmed' AND b.status = 'Confirmed'`);
    assert.equal(overlaps, 0);
  });

  it('adds nothing the second time', () => {
    const db = createTestDatabase({ seed: true });
    assert.deepEqual(seedDatabase(db), { seeded: false });
    assert.equal(count(db, 'SELECT COUNT(*) FROM spots'), 60);
    assert.equal(count(db, 'SELECT COUNT(*) FROM reservations'), 20);
  });
});

describe('database rules', () => {
  const insertReservation = (db, overrides = {}) => db.prepare(`
    INSERT INTO reservations (spot_id, start_date, end_date, guest_name, status)
    VALUES (@spotId, @start, @end, 'Test', @status)`).run({ spotId: 1, start: '2027-05-01', end: '2027-05-03', status: 'Confirmed', ...overrides });

  it('refuses a departure on or before the arrival', () => {
    const db = createTestDatabase({ seed: true });
    assert.throws(() => insertReservation(db, { end: '2027-05-01' }), /CHECK constraint failed/);
  });

  it('refuses unknown enum values and malformed dates', () => {
    const db = createTestDatabase({ seed: true });
    assert.throws(() => insertReservation(db, { status: 'Maybe' }), /CHECK constraint failed/);
    assert.throws(() => insertReservation(db, { start: '1-5-2027' }), /CHECK constraint failed/);
  });

  it('refuses a reservation for a spot that does not exist (foreign keys are on)', () => {
    const db = createTestDatabase({ seed: true });
    assert.throws(() => insertReservation(db, { spotId: 999 }), /FOREIGN KEY constraint failed/);
  });

  it('allows only one deal per day for "all types"', () => {
    const db = createTestDatabase({ seed: true });
    assert.throws(
      () => db.prepare("INSERT INTO deal_days (deal_date, spot_type, discount_percentage) VALUES ('2027-04-13', NULL, 10)").run(),
      /UNIQUE constraint failed/,
    );
  });

  it('refuses a value of the wrong type (STRICT tables)', () => {
    const db = createTestDatabase({ seed: true });
    assert.throws(() => db.prepare("UPDATE spots SET capacity = 'veel' WHERE name = 'T01'").run(), /cannot store TEXT value in INTEGER column/);
  });
});
