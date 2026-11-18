// Shared helpers for the tests: a fresh in-memory database and a running app on a free port.
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

/** A new, migrated in-memory database. Pass { seed: true } for the dummy data. */
export function createTestDatabase({ seed = false } = {}) {
  const db = openDatabase(':memory:');
  migrate(db);
  if (seed) seedDatabase(db);
  return db;
}

/** A quiet logger, so expected errors do not clutter the test output. */
export function createSilentLogger() {
  const errors = [];
  return { errors, error: (...args) => errors.push(args), log() {}, warn() {}, info() {} };
}

/**
 * Starts the app on a free port. Returns the base URL and a close() function.
 * Use with node:test's after()/afterEach() to stop it.
 */
export async function startTestServer({ db = createTestDatabase({ seed: true }), logger = createSilentLogger() } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:' });
  const app = createApp({ db, config, logger });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  return {
    db,
    logger,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}
