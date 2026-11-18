// A fake AI service that follows docs/ai-contract.md, so the team can work without Python running.
// Used by "npm run ai:mock" (server/scripts/ai-mock.js) and by the tests.
// The answers are simple sums, not AI: they only have the right shape.
//
// Modes, to see how the site behaves when the real service misbehaves:
//   ok           normal answers
//   slow         normal answers after `delayMs` (default 10 s)
//   error        500 on every request
//   unavailable  503 on every request
//   bad          200 with the wrong shape
import crypto from 'node:crypto';
import http from 'node:http';
import { addDays, isIsoDate } from '@groene-weide/shared/dates';

export const MOCK_MODES = Object.freeze(['ok', 'slow', 'error', 'unavailable', 'bad']);
const SPOT_TYPES = ['TentCaravan', 'Camper', 'Safari'];
const MAX_BODY_BYTES = 2_000_000;

/**
 * @param {{ key?: string, mode?: string, delayMs?: number }} [options]
 *   key: when set, /v1 requests need this X-Service-Key (like the real service)
 */
export function createMockAiService({ key = '', mode = 'ok', delayMs = 10_000 } = {}) {
  if (!MOCK_MODES.includes(mode)) throw new Error(`Unknown mode "${mode}". Choose one of: ${MOCK_MODES.join(', ')}.`);
  let currentMode = mode;
  const failures = []; // statuses to answer with first, one per request (tests: failNext)
  const requests = []; // what came in, for tests: { method, path, hasValidKey, body }

  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://mock').pathname;
    let body = null;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: { code: 'invalid_json', message: 'Body is not valid JSON' } });
    }
    const hasValidKey = !key || sameText(req.headers['x-service-key'] ?? '', key);
    requests.push({ method: req.method, path, hasValidKey, body });

    if (failures.length > 0) return send(res, failures.shift(), { error: { code: 'mock_failure', message: 'Failure asked for by the test' } });
    if (currentMode === 'error') return send(res, 500, { error: { code: 'internal', message: 'Mock in error mode' } });
    if (currentMode === 'unavailable') return send(res, 503, { error: { code: 'unavailable', message: 'Mock in unavailable mode' } });
    if (currentMode === 'slow') await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (res.destroyed) return; // the caller gave up while we waited

    if (req.method === 'GET' && path === '/health') {
      return send(res, 200, currentMode === 'bad' ? { status: 'maybe' } : { status: 'ok', version: 'mock' });
    }
    if (req.method !== 'POST' || !ROUTES[path]) return send(res, 404, { error: { code: 'not_found', message: 'Unknown endpoint' } });
    if (!hasValidKey) return send(res, 401, { error: { code: 'unauthorized', message: 'Missing or wrong X-Service-Key' } });
    if (currentMode === 'bad') return send(res, 200, { result: 'this is not what the contract says' });

    const problem = ROUTES[path].check(body);
    if (problem) return send(res, 422, { error: { code: 'invalid_input', message: problem } });
    return send(res, 200, ROUTES[path].answer(body));
  });

  return {
    server,
    requests,
    /** Starts listening; resolves with the base URL. Port 0 = any free port. */
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(`http://${host}:${server.address().port}`));
      });
    },
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
    setMode(newMode) {
      if (!MOCK_MODES.includes(newMode)) throw new Error(`Unknown mode "${newMode}"`);
      currentMode = newMode;
    },
    /** The next request(s) get this status, e.g. failNext(503) or failNext(503, 503). */
    failNext(...statuses) {
      failures.push(...statuses);
    },
  };
}

// ---------- Endpoints ----------

const ROUTES = {
  '/v1/occupancy-forecast': {
    check: (body) => (validPeriod(body) && Array.isArray(body.history) ? null : 'Need from, to (at most 92 days later) and history'),
    answer: ({ from, to, history }) => ({ forecast: forecast(from, to, history) }),
  },
  '/v1/purchase-advice': {
    check: (body) => (validPeriod(body) && Array.isArray(body.forecast) ? null : 'Need from, to and forecast'),
    answer: ({ forecast: days }) => ({ advice: purchaseAdvice(days) }),
  },
  '/v1/assistant/answer': {
    check: (body) => (typeof body?.question === 'string' && body.question.trim() && body.question.length <= 500 ? null : 'Need a question of 1-500 characters'),
    answer: ({ campsite }) => ({
      answer: `Dit is een testantwoord van de nep-AI. Voor echte vragen over ${campsite?.name ?? 'de camping'} kun je bellen of mailen.`,
      sources: ['Testgegevens'],
    }),
  },
};

function validPeriod(body) {
  if (!isIsoDate(body?.from) || !isIsoDate(body?.to) || body.to < body.from) return false;
  return addDays(body.from, 92) >= body.to;
}

/** Average occupancy per type in the history, a bit higher on Fridays and Saturdays. */
function forecast(from, to, history) {
  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const spotType of SPOT_TYPES) {
      const rows = history.filter((row) => row.spotType === spotType && row.total > 0);
      const average = rows.length ? rows.reduce((sum, row) => sum + row.occupied / row.total, 0) / rows.length : 0.5;
      const weekend = weekday === 5 || weekday === 6 ? 0.1 : 0;
      days.push({
        date,
        spotType,
        expectedOccupancy: Math.round(Math.min(1, average + weekend) * 100) / 100,
        confidence: rows.length >= 30 ? 0.6 : 0.3,
      });
    }
  }
  return days;
}

function purchaseAdvice(days) {
  const average = days.length ? days.reduce((sum, day) => sum + day.expectedOccupancy, 0) / days.length : 0;
  const nights = new Set(days.map((day) => day.date)).size;
  const guestNights = Math.round(average * 60 * nights * 2.5); // 60 spots, about 2.5 guests per spot
  const percent = Math.round(average * 100);
  return [
    { item: 'Toiletpapier', quantity: Math.ceil(guestNights / 8), unit: 'rollen', reason: `Ongeveer ${percent}% bezetting verwacht over ${nights} nachten.` },
    { item: 'Handzeep', quantity: Math.ceil(guestNights / 150), unit: 'flessen', reason: 'Eén fles per ongeveer 150 gastnachten.' },
    { item: 'Vuilniszakken', quantity: Math.ceil(guestNights / 40), unit: 'stuks', reason: 'Eén zak per ongeveer 40 gastnachten.' },
  ];
}

// ---------- Helpers ----------

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : null;
}

function send(res, status, body) {
  if (res.destroyed) return;
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/** Compares two texts in constant time, so the key cannot be guessed by measuring answer times. */
function sameText(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}
