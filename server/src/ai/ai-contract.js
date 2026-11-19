// Checks every answer from the AI service against docs/ai-contract.md before anything uses it.
// The AI service is a separate program: its answers are treated like any other outside input.
// Each check returns the cleaned answer (only the fields we know) or throws BadAiResponse.
import { isIsoDate } from '@groene-weide/shared/dates';
import { SPOT_TYPES } from '../lib/validate.js';

export const MAX_FORECAST_DAYS = 93; // from … to inclusive (to is at most 92 days after from)
export const MAX_ADVICE_ITEMS = 50;
export const MAX_SOURCES = 10;

/** The answer does not follow the contract. `detail` goes to the server log only. */
export class BadAiResponse extends Error {}

const fail = (detail) => { throw new BadAiResponse(detail); };
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFraction = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function requireText(value, name, max) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) fail(`${name} must be text of 1–${max} characters`);
  return value.trim();
}

function requireArray(body, name, max) {
  if (!isObject(body) || !Array.isArray(body[name])) fail(`${name} must be a list`);
  if (body[name].length > max) fail(`${name} has more than ${max} entries`);
  return body[name];
}

/** POST /v1/occupancy-forecast → [{ date, spotType, expectedOccupancy, confidence }], sorted by date and type. */
export function checkForecast(body, { from, to }) {
  const seen = new Set();
  const days = requireArray(body, 'forecast', MAX_FORECAST_DAYS * SPOT_TYPES.length).map((day, index) => {
    if (!isObject(day)) fail(`forecast[${index}] must be an object`);
    if (!isIsoDate(day.date) || day.date < from || day.date > to) fail(`forecast[${index}].date must be a date from ${from} to ${to}`);
    if (!SPOT_TYPES.includes(day.spotType)) fail(`forecast[${index}].spotType is unknown`);
    if (!isFraction(day.expectedOccupancy)) fail(`forecast[${index}].expectedOccupancy must be 0…1`);
    if (!isFraction(day.confidence)) fail(`forecast[${index}].confidence must be 0…1`);
    const key = `${day.date}/${day.spotType}`;
    if (seen.has(key)) fail(`forecast has ${key} twice`);
    seen.add(key);
    return { date: day.date, spotType: day.spotType, expectedOccupancy: day.expectedOccupancy, confidence: day.confidence };
  });
  return days.sort((a, b) => a.date.localeCompare(b.date) || SPOT_TYPES.indexOf(a.spotType) - SPOT_TYPES.indexOf(b.spotType));
}

/** POST /v1/purchase-advice → [{ item, quantity, unit, reason }] (Dutch texts). */
export function checkPurchaseAdvice(body) {
  return requireArray(body, 'advice', MAX_ADVICE_ITEMS).map((advice, index) => {
    if (!isObject(advice)) fail(`advice[${index}] must be an object`);
    if (typeof advice.quantity !== 'number' || !Number.isFinite(advice.quantity) || advice.quantity < 0) fail(`advice[${index}].quantity must be a number ≥ 0`);
    return {
      item: requireText(advice.item, `advice[${index}].item`, 100),
      quantity: advice.quantity,
      unit: requireText(advice.unit, `advice[${index}].unit`, 30),
      reason: requireText(advice.reason, `advice[${index}].reason`, 300),
    };
  });
}

/** POST /v1/assistant/answer → { answer, sources } */
export function checkAssistantAnswer(body) {
  if (!isObject(body)) fail('the answer must be an object');
  const answer = requireText(body.answer, 'answer', 2000);
  const sources = requireArray(body, 'sources', MAX_SOURCES).map((source, index) => requireText(source, `sources[${index}]`, 200));
  return { answer, sources };
}

/** GET /health → true when the service says it is up. */
export function checkHealth(body) {
  if (!isObject(body) || body.status !== 'ok') fail('status must be "ok"');
  return true;
}
