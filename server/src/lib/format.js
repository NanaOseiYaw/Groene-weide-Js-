// Dutch formatting of amounts, dates and names, so they look the same everywhere
// (port of Services/Format.cs). Only for text people read: the API itself sends
// raw values (cents, 'YYYY-MM-DD') and the frontend formats them the same way.
import { toUtcDate } from './dates.js';

const dateFormat = (options) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', ...options });
const DATE = dateFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const LONG_DATE = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const SHORT_DATE = dateFormat({ day: 'numeric', month: 'short' });
const DAY_MONTH = dateFormat({ day: 'numeric', month: 'long' });

/** 2500 → "€ 25", 2125 → "€ 21,25", 125000 → "€ 1.250". */
export function euro(cents) {
  const wholeEuros = cents % 100 === 0;
  const digits = wholeEuros ? 0 : 2;
  const amount = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
  return `€ ${amount}`;
}

/** "12 juli 2027". */
export const formatDate = (date) => DATE.format(toUtcDate(date));

/** "maandag 12 juli 2027". */
export const formatLongDate = (date) => LONG_DATE.format(toUtcDate(date));

/** "12 jul". */
export const formatShortDate = (date) => SHORT_DATE.format(toUtcDate(date));

/** "12 juli" (no year). */
export const formatDayMonth = (date) => DAY_MONTH.format(toUtcDate(date));

/** "1 nacht" or "3 nachten". */
export const formatNights = (nights) => (nights === 1 ? '1 nacht' : `${nights} nachten`);

/** Reservation number as guests see it: 42 → "GW-00042". */
export const reservationNumber = (id) => `GW-${String(id).padStart(5, '0')}`;

/** Name of a spot type as guests read it. */
export const SPOT_TYPE_LABELS = Object.freeze({
  TentCaravan: 'Tent of caravan',
  Camper: 'Camper',
  Safari: 'Safaritent',
});
