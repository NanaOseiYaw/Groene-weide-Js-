// What the API sends to the AI service, built from the database (docs/ai-contract.md).
// Privacy: only numbers per day and spot type leave this file. No names, e-mail, phone numbers or notes.
import { addDays } from '@groene-weide/shared/dates';
import { SPOT_TYPES } from '../../lib/validate.js';

export const HISTORY_DAYS = 365;

/**
 * Occupied spots per day and type for the HISTORY_DAYS days before `from`, only days the campsite was open.
 * A spot counts as occupied on a night when a confirmed reservation covers it (start ≤ day < end).
 * @returns {{ date: string, spotType: string, occupied: number, total: number }[]}
 */
export function buildOccupancyHistory(db, { from, settings }) {
  const first = addDays(from, -HISTORY_DAYS);
  const totals = new Map(db.prepare('SELECT type, COUNT(*) FROM spots GROUP BY type').raw().all());

  // One query for the whole year: every confirmed reservation that overlaps it, with its type.
  const stays = db.prepare(`
    SELECT s.type, r.start_date, r.end_date
      FROM reservations r JOIN spots s ON s.id = r.spot_id
     WHERE r.status = 'Confirmed' AND r.start_date < ? AND r.end_date > ?`).raw().all(from, first);

  const history = [];
  for (let date = first; date < from; date = addDays(date, 1)) {
    if (!settings.isInSeason(date)) continue;
    for (const spotType of SPOT_TYPES) {
      const occupied = stays.filter(([type, start, end]) => type === spotType && start <= date && date < end).length;
      history.push({ date, spotType, occupied, total: totals.get(spotType) ?? 0 });
    }
  }
  return history;
}
