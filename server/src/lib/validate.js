// Small helpers to read and check request input. They throw an HttpError (400) with a
// Dutch message, so a route can simply call them and let the error handler answer.
// For form fields shown to the user, services collect messages per field instead (422).
import { HttpError } from './errors.js';
import { isIsoDate } from './dates.js';

export const SPOT_TYPES = Object.freeze(['TentCaravan', 'Camper', 'Safari']);

/** Invalid input that is not a form field (e.g. a wrong query parameter): 400. */
export function badRequest(message) {
  return new HttpError(400, 'invalid_request', message);
}

/** 'TentCaravan' | 'Camper' | 'Safari', or a 400 error. */
export function requireSpotType(value) {
  if (!SPOT_TYPES.includes(value)) throw badRequest('Kies een geldig type plek: tent of caravan, camper of safaritent.');
  return value;
}

/** A 'YYYY-MM-DD' date, or a 400 error that names the field. */
export function requireDate(value, label) {
  if (!isIsoDate(value)) throw badRequest(`${label} is geen geldige datum (verwacht: JJJJ-MM-DD).`);
  return value;
}

/** A whole number within [min, max], or a 400 error. Accepts numbers and numeric strings. */
export function requireInteger(value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw badRequest(`${label} is geen geldig getal.`);
  }
  return number;
}

/** Arrival and departure from the query string, with departure after arrival. */
export function requirePeriod(query) {
  const start = requireDate(query.start, 'De aankomstdatum');
  const end = requireDate(query.end, 'De vertrekdatum');
  if (end <= start) throw badRequest('De vertrekdatum moet na de aankomstdatum liggen.');
  return { start, end };
}

/** Trimmed text, or '' when the value is missing or not a string. */
export const text = (value) => (typeof value === 'string' ? value.trim() : '');
