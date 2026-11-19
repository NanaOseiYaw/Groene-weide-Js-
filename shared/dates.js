// Shared by the server and the Vue client (package @groene-weide/shared), so dates work the same everywhere.
// Calendar dates without times, the JavaScript replacement for C#'s DateOnly.
//
// A date is always a string 'YYYY-MM-DD' (e.g. '2027-07-14'). Why strings:
// - new Date('2027-07-14') is midnight UTC, which is still the 13th in some time zones.
//   Strings have no time zone, so a date can never shift by a day.
// - 'YYYY-MM-DD' strings sort and compare like dates: '2027-07-14' < '2027-07-20' is true.
// Calculations go through Date.UTC internally, where there is no daylight saving time.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** true for an existing calendar date in the form 'YYYY-MM-DD' ('2027-02-30' is false). */
export function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  return toIsoDate(new Date(Date.UTC(year, month - 1, day))) === value;
}

/** Builds 'YYYY-MM-DD' from numbers. month is 1–12. */
export function makeDate(year, month, day) {
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

/** '2027-07-14' + 3 → '2027-07-17'. Negative numbers go back in time. */
export function addDays(date, days) {
  return toIsoDate(new Date(toUtc(date) + days * DAY_MS));
}

/** First day of the month after the month of `date`. */
export function firstOfNextMonth(date) {
  const { year, month } = parts(date);
  return makeDate(year, month + 1, 1);
}

/** First day of the month of `date`: '2027-07-14' → '2027-07-01'. */
export function firstOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Same day `months` months later (or earlier when negative). When that day does not exist,
 * the last day of the month is used: '2027-01-31' + 1 → '2027-02-28' (like C# AddMonths).
 */
export function addMonths(date, months) {
  const { year, month, day } = parts(date);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return makeDate(year, month + months, Math.min(day, lastDay));
}

/** Day of the week with Monday = 0 … Sunday = 6 (Dutch calendars start on Monday). */
export function weekdayFromMonday(date) {
  return (new Date(toUtc(date)).getUTCDay() + 6) % 7;
}

/** Number of nights from start to end: ('2027-07-14', '2027-07-17') → 3. */
export function daysBetween(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS);
}

/** Every night of a stay: the arrival day up to and including the day before departure. */
export function* eachNight(start, end) {
  for (let night = start; night < end; night = addDays(night, 1)) yield night;
}

/** { year, month, day } as numbers. */
export function parts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** Today's date in a time zone, e.g. todayIn('Europe/Amsterdam') → '2026-11-18'. */
export function todayIn(timeZone, now = new Date()) {
  // The 'en-CA' locale happens to format dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Converts to a Date at midnight UTC, only for formatting with Intl. */
export function toUtcDate(date) {
  return new Date(toUtc(date));
}

function toUtc(date) {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
}

function toIsoDate(utcDate) {
  return utcDate.toISOString().slice(0, 10);
}
