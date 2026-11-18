// The only file that talks to the Python AI service (docs/ai-contract.md).
//
// Rules, so the AI service can never break booking or the staff pages:
// - every request has a time limit (AI_TIMEOUT_MS) and is aborted after it;
// - forecast and advice are retried once after a connection error or a 502/503/504 (they change nothing);
//   the assistant is never retried (slow and possibly costly);
// - every answer is checked against the contract before it is used (ai-contract.js);
// - every failure becomes an AiUnavailableError, which the API turns into
//   503 { code: "ai_unavailable" } with a calm Dutch message (see errors.js).
// The log gets the endpoint, the reason and the duration; never the key or the data sent.
import { BadAiResponse, checkAssistantAnswer, checkForecast, checkHealth, checkPurchaseAdvice } from './ai-contract.js';
import { AiUnavailableError } from './ai-unavailable-error.js';

export { AiUnavailableError };

const MAX_RESPONSE_BYTES = 1_000_000;
const RETRY_STATUSES = new Set([502, 503, 504]);

/** A non-2xx answer; `code` is the AI service's own error code, for the log. */
class AiHttpError extends Error {
  constructor(status, code) {
    super(`HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {{ url: string|null, key: string, timeoutMs: number }} settings  config.ai
 * @param {{ logger?: Console, fetchImpl?: typeof fetch }} [options]  tests can pass their own fetch
 */
export function createAiClient({ url, key, timeoutMs }, { logger = console, fetchImpl = fetch } = {}) {
  const configured = Boolean(url);

  /** One HTTP request with a time limit. Returns the parsed JSON, or throws. */
  async function send(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key && path.startsWith('/v1/')) headers['X-Service-Key'] = key; // /health needs no key

    // The same signal also covers reading the answer, so a service that sends slowly is stopped too.
    const signal = AbortSignal.timeout(timeoutMs);
    const response = await fetchImpl(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      redirect: 'error', // the address is configured; never follow it somewhere else
    });

    const length = Number(response.headers.get('content-length'));
    if (length > MAX_RESPONSE_BYTES) throw new BadAiResponse(`answer is larger than ${MAX_RESPONSE_BYTES} bytes`);
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new BadAiResponse(`answer is larger than ${MAX_RESPONSE_BYTES} bytes`);

    if (!response.ok) throw new AiHttpError(response.status, errorCodeIn(text));
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new BadAiResponse('answer is not JSON (Content-Type)');
    try {
      return JSON.parse(text);
    } catch {
      throw new BadAiResponse('answer is not valid JSON');
    }
  }

  /** Sends, retries when allowed, checks the answer; turns every failure into AiUnavailableError. */
  async function call(name, { method = 'POST', path, body, check, retry }) {
    if (!configured) throw new AiUnavailableError('not_configured');
    const started = Date.now();
    for (let attempt = 1; ; attempt += 1) {
      try {
        return check(await send(method, path, body));
      } catch (error) {
        const reason = reasonFor(error);
        const retryable = reason === 'network' || (error instanceof AiHttpError && RETRY_STATUSES.has(error.status));
        if (retry && retryable && attempt === 1) continue;
        logFailure(name, reason, error, Date.now() - started, attempt);
        throw new AiUnavailableError(reason);
      }
    }
  }

  function logFailure(name, reason, error, ms, attempts) {
    const tries = attempts > 1 ? `, ${attempts} attempts` : '';
    const detail = error instanceof BadAiResponse ? `: ${error.message}` : error instanceof AiHttpError && error.code ? ` (code ${error.code})` : '';
    const line = `AI service: ${name} failed, ${reason}${detail} after ${ms} ms${tries}`;
    // A refused key is a configuration mistake someone has to fix, not a passing hiccup.
    if (error instanceof AiHttpError && (error.status === 401 || error.status === 403)) logger.error(`${line}. Check AI_SERVICE_KEY.`);
    else logger.warn(line);
  }

  return {
    /** false when AI_SERVICE_URL is empty: every call then fails straight away with "not_configured". */
    configured,

    /** true when the service answers GET /health with "ok". Never throws. */
    async isAvailable() {
      if (!configured) return false;
      try {
        await call('health', { method: 'GET', path: '/health', check: checkHealth, retry: false });
        return true;
      } catch {
        return false;
      }
    },

    /** history: [{ date, spotType, occupied, total }] (anonymous numbers only) → [{ date, spotType, expectedOccupancy, confidence }] */
    occupancyForecast({ from, to, history }) {
      return call('occupancy-forecast', {
        path: '/v1/occupancy-forecast',
        body: { from, to, history },
        check: (answer) => checkForecast(answer, { from, to }),
        retry: true,
      });
    },

    /** forecast: as returned by occupancyForecast → [{ item, quantity, unit, reason }] */
    purchaseAdvice({ from, to, forecast }) {
      return call('purchase-advice', { path: '/v1/purchase-advice', body: { from, to, forecast }, check: checkPurchaseAdvice, retry: true });
    },

    /** question: what a visitor typed; campsite: public details only → { answer, sources } */
    assistantAnswer({ question, campsite }) {
      return call('assistant', {
        path: '/v1/assistant/answer',
        body: { question, language: 'nl', campsite },
        check: checkAssistantAnswer,
        retry: false,
      });
    },
  };
}

function reasonFor(error) {
  if (error instanceof BadAiResponse) return 'bad_response';
  if (error instanceof AiHttpError) return `http_${error.status}`;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return 'network'; // connection refused, DNS, reset, redirect refused, …
}

/** The AI service's error code ({ error: { code } }), only to write in the log. */
function errorCodeIn(text) {
  try {
    const code = JSON.parse(text)?.error?.code;
    return typeof code === 'string' && /^[\w.-]{1,50}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
