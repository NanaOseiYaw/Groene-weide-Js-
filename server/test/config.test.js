import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig, serverRoot } from '../src/config.js';

describe('loadConfig', () => {
  it('has safe defaults for local development', () => {
    const config = loadConfig({});
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.port, 3000);
    assert.equal(config.databasePath, path.join(serverRoot, 'data', 'groeneweide.db'));
    assert.equal(config.seedOnStart, true);
    assert.equal(config.timeZone, 'Europe/Amsterdam');
    assert.equal(config.campsite.name, 'Camping De Groene Weide');
  });

  it('never seeds dummy data in production, even when asked', () => {
    assert.equal(loadConfig({ NODE_ENV: 'production', SEED_ON_START: 'true' }).seedOnStart, false);
  });

  it('can switch seeding off in development', () => {
    assert.equal(loadConfig({ SEED_ON_START: 'false' }).seedOnStart, false);
  });

  it('rejects invalid values with a clear message', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'staging' }), ConfigError);
    assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT must be a whole number/);
    assert.throws(() => loadConfig({ TIME_ZONE: 'Europe/Amsterdm' }), /not a known time zone/);
    assert.throws(() => loadConfig({ SEED_ON_START: 'maybe' }), /SEED_ON_START must be true or false/);
  });

  it('allows the Vite dev server as an origin in development only', () => {
    assert.ok(loadConfig({}).allowedOrigins.includes('http://localhost:5173'));
    assert.deepEqual(loadConfig({ NODE_ENV: 'production' }).allowedOrigins, []);
    assert.deepEqual(loadConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://a.example, https://b.example' }).allowedOrigins, ['https://a.example', 'https://b.example']);
  });

  it('returns a frozen object, so no code can change a setting by accident', () => {
    assert.ok(Object.isFrozen(loadConfig({})));
  });

  describe('AI service', () => {
    it('is switched off by default, with a 5 second time limit', () => {
      assert.deepEqual({ ...loadConfig({}).ai }, { url: null, key: '', timeoutMs: 5000 });
      assert.equal(loadConfig({ AI_SERVICE_URL: '  ' }).ai.url, null);
    });

    it('reads the address without a trailing slash', () => {
      assert.equal(loadConfig({ AI_SERVICE_URL: 'http://localhost:8000/' }).ai.url, 'http://localhost:8000');
    });

    it('rejects a wrong address or time limit', () => {
      assert.throws(() => loadConfig({ AI_SERVICE_URL: 'localhost:8000' }), /AI_SERVICE_URL must/);
      assert.throws(() => loadConfig({ AI_SERVICE_URL: 'ftp://ai.example' }), /must start with http/);
      assert.throws(() => loadConfig({ AI_TIMEOUT_MS: '50' }), /AI_TIMEOUT_MS must be between 100 and 60000/);
      assert.throws(() => loadConfig({ AI_TIMEOUT_MS: 'snel' }), /AI_TIMEOUT_MS must be a whole number/);
    });

    it('needs a real key in production when an address is set', () => {
      const production = { NODE_ENV: 'production', AI_SERVICE_URL: 'https://ai.example' };
      assert.throws(() => loadConfig(production), /AI_SERVICE_KEY must be set/);
      assert.throws(() => loadConfig({ ...production, AI_SERVICE_KEY: 'kort' }), /AI_SERVICE_KEY must be set/);
      assert.equal(loadConfig({ ...production, AI_SERVICE_KEY: 'a'.repeat(16) }).ai.url, 'https://ai.example');
      assert.equal(loadConfig({ NODE_ENV: 'production' }).ai.url, null); // AI off: no key needed
    });
  });
});
