// Rate limits on sign-in and on creating reservations, and the production-only HTTPS header.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createRateLimit } from '../src/lib/rate-limit.js';
import { createTestConfig, startTestServer } from './helpers.js';

describe('createRateLimit', () => {
  it('lets max requests through per window, refuses the rest with 429, and starts again after the window', () => {
    let time = 0;
    const limit = createRateLimit({ max: 2, windowMs: 1000, message: 'Wacht even.', now: () => time });
    const headers = {};
    const res = { set: (name, value) => { headers[name] = value; } };
    const call = (ip = '1.1.1.1') => { let passed; limit({ ip }, res, (error) => { passed = error ?? 'ok'; }); return passed; };

    assert.equal(call(), 'ok');
    assert.equal(call(), 'ok');
    const refused = call();
    assert.equal(refused.status, 429);
    assert.equal(refused.code, 'too_many_requests');
    assert.equal(refused.message, 'Wacht even.');
    assert.equal(headers['Retry-After'], '1');
    assert.equal(call('2.2.2.2'), 'ok', 'another visitor has its own count');

    time = 1000;
    assert.equal(call(), 'ok', 'a new window starts counting again');
  });

  it('does nothing when max is 0', () => {
    const limit = createRateLimit({ max: 0, windowMs: 1000, message: 'x' });
    let passed = 0;
    for (let i = 0; i < 50; i++) limit({ ip: '1.1.1.1' }, {}, () => { passed += 1; });
    assert.equal(passed, 50);
  });
});

describe('rate limits in the app', () => {
  let server;
  before(async () => {
    server = await startTestServer({ config: createTestConfig({ RATE_LIMIT_LOGIN: '3', RATE_LIMIT_RESERVATIONS: '2' }) });
  });
  after(() => server.close());

  it('refuses a fourth sign-in attempt from the same address with a clear message', async () => {
    const attempt = () => server.request('/api/auth/login', { method: 'POST', body: { email: 'niemand@example.com', password: 'fout-wachtwoord' } });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    const refused = await attempt();
    assert.equal(refused.status, 429);
    assert.equal(refused.body.error.code, 'too_many_requests');
    assert.match(refused.body.error.message, /Te veel inlogpogingen/);
    assert.ok(Number(refused.headers.get('retry-after')) > 0);
  });

  it('limits creating reservations, but not looking at the campsite', async () => {
    const create = () => server.request('/api/reservations', { method: 'POST', body: {} });
    assert.equal((await create()).status, 422); // invalid, but counted
    assert.equal((await create()).status, 422);
    assert.equal((await create()).status, 429);
    assert.equal((await server.request('/api/campsite')).status, 200);
  });
});

describe('HTTPS header', () => {
  it('tells browsers to stay on HTTPS in production only', async () => {
    const production = await startTestServer({ config: createTestConfig({ NODE_ENV: 'production' }) });
    const test = await startTestServer();
    try {
      assert.equal((await production.request('/api/health')).headers.get('strict-transport-security'), 'max-age=31536000');
      assert.equal((await test.request('/api/health')).headers.get('strict-transport-security'), null);
      assert.match((await test.request('/api/health')).headers.get('permissions-policy'), /camera=\(\)/);
    } finally {
      production.close();
      test.close();
    }
  });
});
