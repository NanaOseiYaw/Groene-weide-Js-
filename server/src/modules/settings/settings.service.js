// The "settings" table in a convenient form: the season and the "almost full" threshold
// (port of Services/SettingsService.cs). Missing or broken values fall back to safe defaults.
import { makeDate, parts } from '../../lib/dates.js';
import { formatDayMonth } from '../../lib/format.js';

const DEFAULTS = { almostFullThreshold: 3, seasonStart: '04-01', seasonEnd: '10-31' };

/** Reads the settings and returns a CampsiteSettings object with helper functions. */
export function getSettings(db) {
  const values = Object.fromEntries(db.prepare('SELECT setting_key, setting_value FROM settings').raw().all());
  const threshold = Number.parseInt(values.almost_full_threshold, 10);
  return createSettings({
    almostFullThreshold: Number.isInteger(threshold) && threshold >= 0 ? threshold : DEFAULTS.almostFullThreshold,
    seasonStart: parseMonthDay(values.season_start) ?? DEFAULTS.seasonStart,
    seasonEnd: parseMonthDay(values.season_end) ?? DEFAULTS.seasonEnd,
  });
}

/**
 * Settings plus the season rules (business rule 3: outside the season everything is closed).
 * Exported separately so tests can build settings without a database.
 */
export function createSettings({ almostFullThreshold, seasonStart, seasonEnd }) {
  const [startMonth, startDay] = seasonStart.split('-').map(Number);
  const [endMonth, endDay] = seasonEnd.split('-').map(Number);

  const seasonStartOf = (year) => makeDate(year, startMonth, startDay);
  const seasonEndOf = (year) => makeDate(year, endMonth, endDay);

  /** Is the campsite open on this day? */
  const isInSeason = (date) => {
    const { year } = parts(date);
    return date >= seasonStartOf(year) && date <= seasonEndOf(year);
  };

  return Object.freeze({
    almostFullThreshold,
    seasonStart,
    seasonEnd,
    seasonStartOf,
    seasonEndOf,
    isInSeason,

    /** A whole stay lies within one season: arrival and departure in season, in the same year. */
    isStayInSeason: (start, end) => isInSeason(start) && isInSeason(end) && parts(start).year === parts(end).year,

    /** The first day on or after `from` on which the campsite is open. */
    nextOpenDay(from) {
      if (isInSeason(from)) return from;
      const { year } = parts(from);
      return from < seasonStartOf(year) ? seasonStartOf(year) : seasonStartOf(year + 1);
    },

    /** Dutch text for guests, e.g. "1 april t/m 31 oktober". */
    seasonText: `${formatDayMonth(seasonStartOf(2000))} t/m ${formatDayMonth(seasonEndOf(2000))}`,
  });
}

/** "04-01" → "04-01"; anything else → null. */
function parseMonthDay(value) {
  const match = /^(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? value : null;
}
