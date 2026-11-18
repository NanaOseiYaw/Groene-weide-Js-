// Reads all settings from environment variables, checks them once at start-up
// and returns one frozen object. Every other file gets its settings from here,
// never from process.env directly.
//
// Values come from (highest priority first):
//   1. real environment variables (e.g. set by the hosting provider)
//   2. the file ".env" in the repository root (copy of .env.example, not in git)
//   3. the defaults below, which are fine for local development
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the "server" folder. Relative paths in the settings start here. */
export const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverRoot, '..');

const ENVIRONMENTS = ['development', 'production', 'test'];

/** Addresses of the Vite dev server (client/vite.config.js), allowed in development only. */
const VITE_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/** Thrown when a setting has an invalid value. The message says which one and why. */
export class ConfigError extends Error {}

/** Loads ".env" from the repository root, if there is one. Existing variables are not overwritten. */
export function loadEnvFile(file = path.join(repoRoot, '.env')) {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/**
 * Builds the settings object from a set of environment variables.
 * Takes `env` as a parameter so tests can pass their own values.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!ENVIRONMENTS.includes(nodeEnv)) {
    throw new ConfigError(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')} (got "${nodeEnv}").`);
  }

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: readPort(env.PORT, 3000),
    databasePath: readDatabasePath(env.DATABASE_PATH),
    // Dummy data is only ever added in development, never in production.
    seedOnStart: nodeEnv === 'development' && readBoolean('SEED_ON_START', env.SEED_ON_START, true),
    timeZone: readTimeZone(env.TIME_ZONE || 'Europe/Amsterdam'),
    // Development e-mail: mails are written to <mailFolder>/mail.log instead of being sent.
    mailFolder: path.resolve(serverRoot, env.MAIL_FOLDER || 'data/mail'),
    // Simulated payment: how long "Betalen…" takes, so the loading state is visible.
    paymentDelayMs: readNonNegativeInteger('PAYMENT_DELAY_MS', env.PAYMENT_DELAY_MS, 1500),
    // The built Vue frontend (npm run build). Served by Express when it exists.
    clientFolder: path.resolve(serverRoot, env.CLIENT_FOLDER || '../client/dist'),
    // Uploaded spot photos (served publicly at /uploads/spots/<file>).
    spotPhotosFolder: path.join(path.resolve(serverRoot, env.UPLOADS_FOLDER || 'data/uploads'), 'spots'),
    // Other websites (origins) that may send requests that change something, e.g. a separately hosted frontend.
    // The site itself is always allowed. Comma separated: https://a.example,https://b.example
    // In development the Vite dev server (npm run dev, port 5173) passes requests on to the API,
    // so the browser's address differs from the API's: that address is allowed in development only.
    allowedOrigins: Object.freeze([
      ...readList(env.ALLOWED_ORIGINS),
      ...(nodeEnv === 'development' ? VITE_DEV_ORIGINS : []),
    ]),
    campsite: Object.freeze({
      name: env.CAMPSITE_NAME || 'Camping De Groene Weide',
      phone: env.CAMPSITE_PHONE || '',
      email: env.CAMPSITE_EMAIL || '',
    }),
    ai: readAiSettings(env, nodeEnv),
  });
}

/**
 * The Python AI service (docs/ai-contract.md). No URL = AI switched off; the rest of the site
 * works the same either way. In production a URL needs a real key, so the service is never open to anyone.
 */
function readAiSettings(env, nodeEnv) {
  const url = (env.AI_SERVICE_URL ?? '').trim().replace(/\/+$/, '');
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConfigError(`AI_SERVICE_URL must be a web address such as http://localhost:8000 (got "${url}").`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ConfigError(`AI_SERVICE_URL must start with http:// or https:// (got "${url}").`);
    }
  }
  const key = env.AI_SERVICE_KEY ?? '';
  if (url && nodeEnv === 'production' && key.length < 16) {
    throw new ConfigError('AI_SERVICE_KEY must be set (at least 16 characters) when AI_SERVICE_URL is set in production.');
  }
  const timeoutMs = readNonNegativeInteger('AI_TIMEOUT_MS', env.AI_TIMEOUT_MS, 5000);
  if (timeoutMs < 100 || timeoutMs > 60_000) {
    throw new ConfigError(`AI_TIMEOUT_MS must be between 100 and 60000 milliseconds (got "${env.AI_TIMEOUT_MS}").`);
  }
  return Object.freeze({ url: url || null, key, timeoutMs });
}

function readPort(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`PORT must be a whole number between 0 and 65535 (got "${value}").`);
  }
  return port;
}

function readList(value) {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function readNonNegativeInteger(name, value, fallback) {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ConfigError(`${name} must be a whole number of 0 or more (got "${value}").`);
  }
  return number;
}

function readDatabasePath(value) {
  // ":memory:" is a database that only exists while the process runs (used by tests).
  if (value === ':memory:') return value;
  return path.resolve(serverRoot, value || 'data/groeneweide.db');
}

function readBoolean(name, value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  throw new ConfigError(`${name} must be true or false (got "${value}").`);
}

function readTimeZone(value) {
  try {
    // Throws a RangeError for an unknown time zone such as "Europe/Amsterdm".
    new Intl.DateTimeFormat('nl-NL', { timeZone: value });
    return value;
  } catch {
    throw new ConfigError(`TIME_ZONE "${value}" is not a known time zone, for example Europe/Amsterdam.`);
  }
}
