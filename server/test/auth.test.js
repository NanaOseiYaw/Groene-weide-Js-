// Staff sign-in: passwords, lockout, sessions, the cookie and protection of the staff routes.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { hashPassword, verifyPassword } from '../src/lib/passwords.js';
import { createStaffUser } from '../src/modules/auth/staff-users.service.js';
import { createTestConfig, createTestDatabase, startTestServer } from './helpers.js';

const login = (server, body, options = {}) => server.request('/api/auth/login', { method: 'POST', body, ...options });

describe('passwords', () => {
  it('stores a salted scrypt hash, never the password', async () => {
    const first = await hashPassword('een-lang-wachtwoord');
    const second = await hashPassword('een-lang-wachtwoord');
    assert.match(first, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!first.includes('een-lang-wachtwoord'));
    assert.notEqual(first, second); // different salt each time
    assert.equal(await verifyPassword('een-lang-wachtwoord', first), true);
    assert.equal(await verifyPassword('een-lang-wachtwoorD', first), false);
    assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
  });

  it('refuses accounts with a short password, a wrong role or a duplicate e-mail address', async () => {
    const db = createTestDatabase();
    await assert.rejects(createStaffUser(db, { name: 'A', email: 'a@example.com', password: 'kort', role: 'Staff' }), /minimaal 10 tekens/);
    await assert.rejects(createStaffUser(db, { name: 'A', email: 'a@example.com', password: 'lang-genoeg-1', role: 'Boss' }), /rol moet Staff of Admin/);
    await createStaffUser(db, { name: 'A', email: 'a@example.com', password: 'lang-genoeg-1', role: 'Staff' });
    await assert.rejects(createStaffUser(db, { name: 'B', email: 'A@Example.com', password: 'lang-genoeg-1', role: 'Staff' }), /bestaat al een account/);
  });
});

describe('sign-in', () => {
  let server;
  before(async () => {
    server = await startTestServer();
    await createStaffUser(server.db, { name: 'Anita', email: 'anita@example.com', password: 'een-lang-wachtwoord', role: 'Staff' });
  });
  after(() => server.close());

  it('signs in with a safe session cookie (HttpOnly, SameSite=Lax, no expiry without "Onthoud mij")', async () => {
    const { status, body, headers } = await login(server, { email: 'Anita@example.com ', password: 'een-lang-wachtwoord' });
    assert.equal(status, 200);
    assert.deepEqual(body.staff, { id: 1, name: 'Anita', email: 'anita@example.com', role: 'Staff' });
    const cookie = headers.get('set-cookie');
    assert.match(cookie, /^gw_session=[\w-]{43};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Expires|Secure/); // a browser-session cookie; Secure only in production
    assert.equal(headers.get('cache-control'), 'no-store');
  });

  it('"Onthoud mij" keeps the cookie for 30 days', async () => {
    const { headers } = await login(server, { email: 'anita@example.com', password: 'een-lang-wachtwoord', rememberMe: true });
    const expires = new Date(/Expires=([^;]+)/.exec(headers.get('set-cookie'))[1]);
    const days = (expires - server.clock.now()) / 86_400_000;
    assert.ok(days > 29.9 && days <= 30, `cookie expires after ${days} days`);
  });

  it('gives the same answer for a wrong password and an unknown e-mail address', async () => {
    const wrongPassword = await login(server, { email: 'anita@example.com', password: 'fout-wachtwoord' });
    const unknown = await login(server, { email: 'niemand@example.com', password: 'fout-wachtwoord' });
    for (const result of [wrongPassword, unknown]) {
      assert.equal(result.status, 401);
      assert.deepEqual(result.body.error, { code: 'invalid_credentials', message: 'E-mailadres of wachtwoord klopt niet.' });
    }
    // Reset the failure counter for the next tests.
    await login(server, { email: 'anita@example.com', password: 'een-lang-wachtwoord' });
  });

  it('asks for both fields', async () => {
    const { status, body } = await login(server, {});
    assert.equal(status, 422);
    assert.deepEqual(body.error.fields, { email: 'Vul je e-mailadres in.', password: 'Vul je wachtwoord in.' });
  });

  it('GET /api/auth/me tells who is signed in, and logout ends the session', async () => {
    const cookie = await server.signIn();
    const me = await server.request('/api/auth/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.staff.email, 'anita@example.com');

    const logout = await server.request('/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /gw_session=;/);
    assert.equal((await server.request('/api/auth/me', { cookie })).status, 401); // the old cookie no longer works
  });

  it('a session expires after 30 days without use', async () => {
    const fresh = await startTestServer();
    try {
      const cookie = await fresh.signIn();
      fresh.clock.advanceMinutes(30 * 24 * 60 + 1);
      assert.equal((await fresh.request('/api/auth/me', { cookie })).status, 401);
    } finally {
      await fresh.close();
    }
  });
});

describe('lockout after 5 wrong passwords', () => {
  let server;
  before(async () => {
    server = await startTestServer();
    await createStaffUser(server.db, { name: 'Bert', email: 'bert@example.com', password: 'een-lang-wachtwoord', role: 'Admin' });
  });
  after(() => server.close());

  it('locks the account for 10 minutes, even for the right password, then lets the user in again', async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      assert.equal((await login(server, { email: 'bert@example.com', password: 'fout' })).status, 401);
    }
    const fifth = await login(server, { email: 'bert@example.com', password: 'fout' });
    assert.equal(fifth.status, 429);
    assert.equal(fifth.body.error.message, 'Er is te vaak een verkeerd wachtwoord ingevuld. Wacht 10 minuten en probeer het dan opnieuw.');

    server.clock.advanceMinutes(9);
    const stillLocked = await login(server, { email: 'bert@example.com', password: 'een-lang-wachtwoord' });
    assert.equal(stillLocked.status, 429);
    assert.match(stillLocked.body.error.message, /Wacht 1 minuut /);

    server.clock.advanceMinutes(1);
    assert.equal((await login(server, { email: 'bert@example.com', password: 'een-lang-wachtwoord' })).status, 200);
  });

  it('cannot be skipped by sending many wrong passwords at the same moment', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => login(server, { email: 'bert@example.com', password: 'fout' })));
    assert.ok(results.some((r) => r.status === 429), results.map((r) => r.status).join(','));
    assert.equal((await login(server, { email: 'bert@example.com', password: 'een-lang-wachtwoord' })).status, 429);
  });
});

describe('protection of the staff routes', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  const staffRoutes = [
    ['GET', '/api/admin/day/2027-07-20'],
    ['GET', '/api/admin/calendar?year=2027&month=7'],
    ['GET', '/api/admin/reservations'],
    ['POST', '/api/admin/reservations'],
    ['POST', '/api/admin/reservations/1/cancel'],
    ['GET', '/api/admin/needs-move'],
    ['GET', '/api/admin/availability?type=Camper&year=2027&month=7'],
    ['GET', '/api/admin/availability/check?type=Camper&start=2027-07-01&end=2027-07-02'],
    ['GET', '/api/admin/free-spots?type=Camper&start=2027-07-01&end=2027-07-02'],
    ['GET', '/api/admin/spots'],
    ['POST', '/api/admin/spots/1/unavailable'],
    ['POST', '/api/admin/spots/1/available'],
    ['POST', '/api/admin/fields/Kampeerveld/unavailable'],
    ['POST', '/api/admin/fields/Kampeerveld/available'],
    ['GET', '/api/admin/spots/1/photos'],
    ['POST', '/api/admin/spots/1/photos'],
    ['PATCH', '/api/admin/photos/1'],
    ['POST', '/api/admin/photos/1/move'],
    ['DELETE', '/api/admin/photos/1'],
  ];

  it('answers 401 on every staff route without signing in, and changes nothing', async () => {
    for (const [method, path] of staffRoutes) {
      const { status, body } = await server.request(path, { method, body: method === 'GET' ? undefined : { reason: 'Accident' } });
      assert.equal(status, 401, `${method} ${path}`);
      assert.equal(body.error.code, 'not_signed_in');
    }
    assert.equal(server.db.prepare('SELECT COUNT(*) FROM spots WHERE is_available = 0').pluck().get(), 0);
    assert.equal(server.db.prepare("SELECT COUNT(*) FROM reservations WHERE status = 'Cancelled'").pluck().get(), 0);
  });

  it('refuses a made-up session cookie', async () => {
    const { status } = await server.request('/api/admin/reservations', { cookie: 'gw_session=verzonnen-token' });
    assert.equal(status, 401);
  });

  it('refuses a request that changes something when it comes from another website (CSRF)', async () => {
    const cookie = await server.signIn();
    const forged = await server.request('/api/admin/spots/1/unavailable', {
      method: 'POST', cookie, body: { reason: 'Accident' }, headers: { Origin: 'https://evil.example' },
    });
    assert.equal(forged.status, 403);
    assert.equal(forged.body.error.code, 'forbidden_origin');
    assert.equal(server.db.prepare('SELECT is_available FROM spots WHERE id = 1').pluck().get(), 1);

    const sameSite = await server.request('/api/admin/spots/1/unavailable', {
      method: 'POST', cookie, body: { reason: 'Accident' }, headers: { Origin: server.baseUrl },
    });
    assert.equal(sameSite.status, 200);
  });

  it('marks staff responses as not cacheable', async () => {
    const cookie = await server.signIn();
    const { headers } = await server.request('/api/admin/needs-move', { cookie });
    assert.equal(headers.get('cache-control'), 'no-store');
  });
});

describe('production cookie', () => {
  it('is only sent over HTTPS (Secure)', async () => {
    const server = await startTestServer({ config: createTestConfig({ NODE_ENV: 'production' }) });
    try {
      await createStaffUser(server.db, { name: 'Anita', email: 'anita@example.com', password: 'een-lang-wachtwoord', role: 'Staff' });
      const { headers } = await login(server, { email: 'anita@example.com', password: 'een-lang-wachtwoord' });
      assert.match(headers.get('set-cookie'), /Secure/);
    } finally {
      await server.close();
    }
  });
});
