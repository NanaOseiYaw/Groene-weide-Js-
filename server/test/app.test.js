import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('HTTP app', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(() => server.close());

  it('GET /api/health answers ok when the database is reachable', async () => {
    const response = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', environment: 'test' });
  });

  it('answers 404 with the standard error shape for an unknown route', async () => {
    const response = await fetch(`${server.baseUrl}/api/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error.code, 'not_found');
    assert.equal(typeof body.error.message, 'string');
  });

  it('answers 400 invalid_json for a body that is not valid JSON', async () => {
    const response = await fetch(`${server.baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "broken": ',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'invalid_json');
  });

  it('sends security headers and hides the framework', async () => {
    const response = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

describe('HTTP app when the database is gone', () => {
  it('GET /api/health answers 503 and logs the problem', async () => {
    const server = await startTestServer();
    server.db.close(); // simulate a broken database connection
    try {
      const response = await fetch(`${server.baseUrl}/api/health`);
      assert.equal(response.status, 503);
      assert.equal(server.logger.errors.length, 1);
    } finally {
      await server.close(); // closing an already closed database is harmless
    }
  });
});
