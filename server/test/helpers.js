// Shared helpers for the tests: a fresh in-memory database and a running app on a free port.
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { createMemoryEmailSender } from '../src/lib/email.js';
import { createFakePaymentService } from '../src/lib/payment.js';
import { createStaffUser, findStaffByEmail } from '../src/modules/auth/staff-users.service.js';

/**
 * "Today" in the tests. The seed has reservations in the 2027 season, so tests use a fixed
 * day before that season: results never depend on the real date the tests run on.
 */
export const TEST_TODAY = '2027-01-15';

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
  const warnings = [];
  return { errors, warnings, error: (...args) => errors.push(args), warn: (...args) => warnings.push(args), log() {}, info() {} };
}

/** Settings for tests: the in-memory database, no payment delay, and optionally extra variables. */
export function createTestConfig(env = {}) {
  return loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:', PAYMENT_DELAY_MS: '0', ...env });
}

/**
 * Starts the app on a free port. Returns the base URL, the sent e-mails and a close() function.
 * Use with node:test's before()/after() to start and stop it.
 */
export async function startTestServer({
  db = createTestDatabase({ seed: true }),
  logger = createSilentLogger(),
  today = TEST_TODAY,
  payment = createFakePaymentService({ delayMs: 0 }),
  email = createMemoryEmailSender(),
  config = createTestConfig(),
} = {}) {
  // "now" can be moved forward by tests (e.g. to the end of a lockout): server.clock.advanceMinutes(10).
  let now = new Date(`${today}T10:00:00Z`);
  const clock = {
    today: () => today,
    now: () => now,
    advanceMinutes: (minutes) => { now = new Date(now.getTime() + minutes * 60_000); },
  };
  const app = createApp({ db, config, logger, clock, payment, email });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    db,
    logger,
    email,
    clock,
    baseUrl,
    /**
     * fetch() relative to the server. `body` is sent as JSON, a FormData as multipart.
     * Returns { status, body, headers }; body is null for an empty response (204).
     */
    async request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
      const isForm = body instanceof FormData;
      const response = await fetch(baseUrl + path, {
        method,
        headers: {
          ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      });
      const raw = await response.text();
      return { status: response.status, body: raw ? JSON.parse(raw) : null, headers: response.headers };
    },
    /** Creates a staff account and signs in. Returns the cookie to send with staff requests. */
    async signIn({ email = 'anita@example.com', password = 'een-lang-wachtwoord', role = 'Staff', rememberMe = false } = {}) {
      if (!findStaffByEmail(db, email)) await createStaffUser(db, { name: 'Anita', email, password, role });
      const { status, headers } = await this.request('/api/auth/login', { method: 'POST', body: { email, password, rememberMe } });
      if (status !== 200) throw new Error(`Sign-in failed with ${status}`);
      return headers.get('set-cookie').split(';')[0];
    },
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}

/** A complete, valid guest booking body. Override what a test needs. */
export function guestBooking(overrides = {}) {
  return {
    spotId: 41, // C01 in the seed (ids follow the insert order: T01–T40 = 1–40, C01–C12 = 41–52, S1–S8 = 53–60)
    type: 'Camper',
    start: '2027-05-10',
    end: '2027-05-13',
    guest: { name: 'Test Gast', email: 'gast@example.com', phone: '06 12345678' },
    ...overrides,
  };
}
