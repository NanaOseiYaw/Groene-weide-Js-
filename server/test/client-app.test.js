// Serving the built Vue frontend from Express (production), next to the API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createTestConfig, startTestServer } from './helpers.js';

describe('built frontend', () => {
  let server;
  let folder;
  before(async () => {
    // A dot folder in the path on purpose: the app must also work when installed under e.g. ".claude".
    folder = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'groene-weide-dist-')), '.hidden', 'dist');
    fs.mkdirSync(path.join(folder, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), '<!doctype html><title>Groene Weide</title><div id="app"></div>');
    fs.writeFileSync(path.join(folder, 'assets', 'index-abc123.js'), 'console.log("app")');
    fs.writeFileSync(path.join(folder, 'favicon.png'), 'png');
    server = await startTestServer({ config: createTestConfig({ CLIENT_FOLDER: folder }) });
  });
  after(async () => {
    await server.close();
    fs.rmSync(path.resolve(folder, '..', '..'), { recursive: true, force: true });
  });

  const get = (urlPath, accept = 'text/html') => fetch(server.baseUrl + urlPath, { headers: { Accept: accept } });

  it('serves index.html for every page address, so the Vue router can show the page', async () => {
    for (const page of ['/', '/reserveren', '/admin/reservations', '/bestaat-niet']) {
      const response = await get(page);
      assert.equal(response.status, 200, page);
      assert.match(await response.text(), /<div id="app">/);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
    }
  });

  it('sends a strict Content-Security-Policy with the page', async () => {
    const csp = (await get('/')).headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
  });

  it('serves built files, with long caching for hashed assets', async () => {
    const asset = await get('/assets/index-abc123.js', '*/*');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
    assert.equal((await get('/favicon.png', 'image/*')).status, 200);
  });

  it('never answers an API or upload address with the web page', async () => {
    const api = await get('/api/bestaat-niet');
    assert.equal(api.status, 404);
    assert.equal((await api.json()).error.code, 'not_found');
    assert.equal((await get('/uploads/spots/geen.png')).status, 404);
    assert.equal((await get('/assets/geen.js', '*/*')).status, 404);
    assert.equal((await get('/favicon.ico', '*/*')).status, 404);
  });
});
