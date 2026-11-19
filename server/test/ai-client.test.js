// The AI client against the fake AI service over real HTTP (docs/ai-contract.md):
// success, time limit, 5xx, wrong answers, retry rules, the key, and that failures never leak details.
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { checkForecast } from '../src/ai/ai-contract.js';
import { AiUnavailableError, createAiClient } from '../src/ai/ai-client.js';
import { createMockAiService } from '../src/ai/mock-ai-service.js';
import { createSilentLogger } from './helpers.js';

const KEY = 'test-key-0123456789abcdef';
const PERIOD = { from: '2027-07-01', to: '2027-07-03' };
const HISTORY = [{ date: '2026-07-01', spotType: 'Camper', occupied: 6, total: 12 }];

/** Asserts that the promise fails with AiUnavailableError for this reason. */
async function assertUnavailable(promise, reason) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AiUnavailableError, `expected AiUnavailableError, got ${error}`);
    assert.equal(error.reason, reason);
    return true;
  });
}

describe('AI client', () => {
  let mock;
  let url;
  let logger;
  const client = (settings = {}) => createAiClient({ url, key: KEY, timeoutMs: 300, ...settings }, { logger });

  before(async () => {
    mock = createMockAiService({ key: KEY, delayMs: 1000 });
    url = await mock.listen();
  });
  after(() => mock.close());
  beforeEach(() => {
    mock.setMode('ok');
    mock.requests.length = 0;
    logger = createSilentLogger();
  });

  describe('success', () => {
    it('gets a forecast for every day and type in the period, sends the key and only the numbers', async () => {
      const forecast = await client().occupancyForecast({ ...PERIOD, history: HISTORY });
      assert.equal(forecast.length, 3 * 3);
      assert.deepEqual(forecast[0], { date: '2027-07-01', spotType: 'TentCaravan', expectedOccupancy: 0.5, confidence: 0.3 });
      assert.equal(forecast.find((d) => d.spotType === 'Camper').expectedOccupancy, 0.5);

      const [request] = mock.requests;
      assert.equal(request.path, '/v1/occupancy-forecast');
      assert.equal(request.hasValidKey, true);
      assert.deepEqual(request.body, { ...PERIOD, history: HISTORY });
    });

    it('gets purchase advice and an assistant answer in the contract shape', async () => {
      const advice = await client().purchaseAdvice({ ...PERIOD, forecast: [{ date: '2027-07-01', spotType: 'Camper', expectedOccupancy: 0.5, confidence: 0.3 }] });
      assert.ok(advice.length > 0);
      for (const item of advice) assert.deepEqual(Object.keys(item), ['item', 'quantity', 'unit', 'reason']);

      const answer = await client().assistantAnswer({ question: 'Mag mijn hond mee?', campsite: { name: 'Camping De Groene Weide', season: { start: '04-01', end: '10-31' } } });
      assert.match(answer.answer, /nep-AI/);
      assert.deepEqual(answer.sources, ['Testgegevens']);
      assert.equal(mock.requests.at(-1).body.language, 'nl');
    });

    it('reports the service as available, without sending the key to /health', async () => {
      assert.equal(await client().isAvailable(), true);
      assert.equal(mock.requests[0].path, '/health');
    });
  });

  describe('switched off', () => {
    it('fails at once with "not_configured" when there is no URL, without any request', async () => {
      const off = createAiClient({ url: null, key: '', timeoutMs: 300 }, { logger });
      assert.equal(off.configured, false);
      await assertUnavailable(off.occupancyForecast({ ...PERIOD, history: [] }), 'not_configured');
      assert.equal(await off.isAvailable(), false);
      assert.equal(mock.requests.length, 0);
    });
  });

  describe('time limit', () => {
    it('gives up after AI_TIMEOUT_MS and does not retry a timeout', async () => {
      mock.setMode('slow'); // answers after 1000 ms, the limit is 300 ms
      const started = Date.now();
      await assertUnavailable(client().occupancyForecast({ ...PERIOD, history: [] }), 'timeout');
      const took = Date.now() - started;
      assert.ok(took >= 250 && took < 900, `took ${took} ms`);
      assert.equal(mock.requests.length, 1);
      assert.match(logger.warnings[0][0], /occupancy-forecast failed, timeout after \d+ ms/);
    });

    it('also stops a service that sends its answer too slowly', async () => {
      // Headers straight away, then the body never finishes.
      const trickle = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"forecast": [');
      });
      const trickleUrl = await new Promise((resolve) => trickle.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${trickle.address().port}`)));
      try {
        await assertUnavailable(client({ url: trickleUrl }).occupancyForecast({ ...PERIOD, history: [] }), 'timeout');
      } finally {
        trickle.closeAllConnections();
        trickle.close();
      }
    });
  });

  describe('server errors and retries', () => {
    it('retries a forecast once after a 503 and then succeeds', async () => {
      mock.failNext(503);
      const forecast = await client().occupancyForecast({ ...PERIOD, history: [] });
      assert.equal(forecast.length, 9);
      assert.equal(mock.requests.length, 2);
      assert.equal(logger.warnings.length, 0);
    });

    it('gives up after the second 502/503/504', async () => {
      mock.failNext(502, 504);
      await assertUnavailable(client().occupancyForecast({ ...PERIOD, history: [] }), 'http_504');
      assert.equal(mock.requests.length, 2);
      assert.match(logger.warnings[0][0], /http_504 \(code mock_failure\) after \d+ ms, 2 attempts/);
    });

    it('does not retry a 500', async () => {
      mock.setMode('error');
      await assertUnavailable(client().purchaseAdvice({ ...PERIOD, forecast: [] }), 'http_500');
      assert.equal(mock.requests.length, 1);
    });

    it('never retries the assistant, not even after a 503', async () => {
      mock.failNext(503);
      await assertUnavailable(client().assistantAnswer({ question: 'Hallo?', campsite: { name: 'x', season: { start: '04-01', end: '10-31' } } }), 'http_503');
      assert.equal(mock.requests.length, 1);
    });

    it('retries once when the service cannot be reached at all', async () => {
      const closed = createMockAiService();
      const closedUrl = await closed.listen();
      await closed.close(); // nothing listens on this port any more
      const calls = [];
      const countingFetch = (...args) => { calls.push(args[0]); return fetch(...args); };
      const unreachable = createAiClient({ url: closedUrl, key: KEY, timeoutMs: 300 }, { logger, fetchImpl: countingFetch });
      await assertUnavailable(unreachable.occupancyForecast({ ...PERIOD, history: [] }), 'network');
      assert.equal(calls.length, 2);
    });

    it('logs a refused key as an error that says what to check, without the key itself', async () => {
      await assertUnavailable(client({ key: 'a-wrong-key-0123456789' }).occupancyForecast({ ...PERIOD, history: [] }), 'http_401');
      assert.equal(mock.requests.length, 1); // 401 is not retried
      const line = logger.errors[0][0];
      assert.match(line, /Check AI_SERVICE_KEY/);
      assert.ok(!line.includes('a-wrong-key') && !line.includes(KEY));
    });
  });

  describe('wrong answers', () => {
    it('refuses an answer in the wrong shape', async () => {
      mock.setMode('bad');
      await assertUnavailable(client().occupancyForecast({ ...PERIOD, history: [] }), 'bad_response');
      await assertUnavailable(client().purchaseAdvice({ ...PERIOD, forecast: [] }), 'bad_response');
      await assertUnavailable(client().assistantAnswer({ question: 'Hallo?', campsite: {} }), 'bad_response');
      assert.equal(await client().isAvailable(), false);
      assert.match(logger.warnings[0][0], /bad_response: forecast must be a list/);
    });

    it('refuses an answer that is not JSON, or too large', async () => {
      const odd = http.createServer((req, res) => {
        if (req.url.includes('forecast')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html>proxy error page</html>');
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 5_000_000 });
          res.end();
        }
      });
      const oddUrl = await new Promise((resolve) => odd.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${odd.address().port}`)));
      try {
        await assertUnavailable(client({ url: oddUrl }).occupancyForecast({ ...PERIOD, history: [] }), 'bad_response');
        await assertUnavailable(client({ url: oddUrl }).purchaseAdvice({ ...PERIOD, forecast: [] }), 'bad_response');
      } finally {
        odd.closeAllConnections();
        odd.close();
      }
    });

    it('checks every value of a forecast against the contract', () => {
      const day = { date: '2027-07-01', spotType: 'Camper', expectedOccupancy: 0.5, confidence: 0.5 };
      const check = (forecast) => checkForecast({ forecast }, PERIOD);
      assert.deepEqual(check([{ ...day, extra: 'dropped' }]), [day]);
      assert.throws(() => check([{ ...day, date: '2027-07-04' }]), /date must be a date from 2027-07-01 to 2027-07-03/);
      assert.throws(() => check([{ ...day, spotType: 'Tent' }]), /spotType is unknown/);
      assert.throws(() => check([{ ...day, expectedOccupancy: 1.2 }]), /expectedOccupancy must be 0…1/);
      assert.throws(() => check([{ ...day, confidence: Number.NaN }]), /confidence must be 0…1/);
      assert.throws(() => check([day, day]), /twice/);
      assert.throws(() => checkForecast({ forecast: 'x' }, PERIOD), /must be a list/);
      assert.throws(() => checkForecast(null, PERIOD), /must be a list/);
    });
  });
});
