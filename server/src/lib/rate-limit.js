// A small rate limit per visitor (IP address), kept in memory.
//
// Each visitor may make `max` requests per window; after that the answer is 429 with a clear
// Dutch message and a Retry-After header, until the window is over. In memory is enough here:
// the app runs as one Node process (SQLite, see the migration plan), and a restart simply
// starts counting again. Behind the hosting's proxy, req.ip is the visitor's address because
// app.js sets "trust proxy" in production.
import { HttpError } from './errors.js';

/**
 * @param {object} options
 * @param {number} options.max       requests per window; 0 switches the limit off
 * @param {number} options.windowMs  length of the window in milliseconds
 * @param {string} options.message   Dutch text for the visitor
 * @param {() => number} [options.now]
 */
export function createRateLimit({ max, windowMs, message, now = () => Date.now() }) {
  const visitors = new Map(); // ip → { count, resetAt }

  return function rateLimit(req, res, next) {
    if (max === 0) return next();
    const time = now();
    const key = req.ip ?? 'unknown';

    let entry = visitors.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      visitors.set(key, entry);
    }
    entry.count += 1;

    // Forget visitors whose window is over, so the map cannot keep growing.
    if (visitors.size > 10_000) {
      for (const [ip, e] of visitors) if (e.resetAt <= time) visitors.delete(ip);
    }

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)));
      return next(new HttpError(429, 'too_many_requests', message));
    }
    next();
  };
}
