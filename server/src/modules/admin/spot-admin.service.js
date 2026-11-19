// Taking spots out of use and back into use (staff only). Port of SpotAdminService.cs.
// A spot that is out of use disappears from guest booking automatically, because every guest
// query uses the central BOOKABLE rule. Guests never see the reason.
import { HttpError } from '../../lib/errors.js';

export const UNAVAILABLE_REASONS = Object.freeze(['WetSeason', 'Accident', 'Maintenance']);

/** Status of a spot as staff see it (priority: out of use > reserved > reserve tent > free). */
const statusOf = (spot, guestName) =>
  spot.is_available === 0 ? 'Unavailable' : guestName ? 'Reserved' : spot.is_held === 1 ? 'Held' : 'Free';

/** All 60 spots with their status on the chosen day, in field order (Kampeerveld, Camperveld, Safariveld). */
export function getSpotOverview(db, day) {
  const spots = db.prepare(`
    SELECT * FROM spots
     ORDER BY CASE type WHEN 'TentCaravan' THEN 1 WHEN 'Camper' THEN 2 ELSE 3 END, name`).all();
  const guestBySpot = new Map(
    db.prepare(`SELECT spot_id, guest_name FROM reservations
                 WHERE status = 'Confirmed' AND start_date <= ? AND end_date > ? ORDER BY start_date`)
      .raw()
      .all(day, day),
  );

  return spots.map((spot) => {
    const reservedBy = guestBySpot.get(spot.id) ?? null;
    return {
      id: spot.id,
      name: spot.name,
      type: spot.type,
      fieldName: spot.field_name,
      isAvailable: spot.is_available === 1,
      unavailableReason: spot.unavailable_reason,
      isHeld: spot.is_held === 1,
      reservedBy,
      status: statusOf(spot, reservedBy),
    };
  });
}

/**
 * Takes one spot or a whole field out of use with a reason. All current and future confirmed
 * reservations on those spots get needs_move = 1.
 * @param {{ spotId?: number, fieldName?: string, reason: string, today: string }} target
 * @returns {{ spots: number, needsMove: number }} how many spots were changed and reservations flagged
 */
export function setUnavailable(db, { spotId, fieldName, reason, today }) {
  if (!UNAVAILABLE_REASONS.includes(reason)) {
    throw new HttpError(422, 'validation_failed', 'Kies een reden: natseizoen, ongeluk of onderhoud.', { reason: 'Kies een reden.' });
  }
  return db.transaction(() => {
    const ids = findSpotIds(db, { spotId, fieldName });
    const mark = db.prepare('UPDATE spots SET is_available = 0, unavailable_reason = ? WHERE id = ?');
    const flag = db.prepare("UPDATE reservations SET needs_move = 1 WHERE spot_id = ? AND status = 'Confirmed' AND end_date > ?");
    let needsMove = 0;
    for (const id of ids) {
      mark.run(reason, id);
      needsMove += flag.run(id, today).changes;
    }
    return { spots: ids.length, needsMove };
  }).immediate();
}

/** Puts one spot or a whole field back into use: the reason is cleared and its guests no longer need moving. */
export function setAvailable(db, { spotId, fieldName }) {
  return db.transaction(() => {
    const ids = findSpotIds(db, { spotId, fieldName });
    const mark = db.prepare('UPDATE spots SET is_available = 1, unavailable_reason = NULL WHERE id = ?');
    const clear = db.prepare('UPDATE reservations SET needs_move = 0 WHERE spot_id = ? AND needs_move = 1');
    for (const id of ids) {
      mark.run(id);
      clear.run(id);
    }
    return { spots: ids.length };
  }).immediate();
}

function findSpotIds(db, { spotId, fieldName }) {
  const ids = spotId !== undefined
    ? db.prepare('SELECT id FROM spots WHERE id = ?').pluck().all(spotId)
    : db.prepare('SELECT id FROM spots WHERE field_name = ?').pluck().all(fieldName);
  if (ids.length === 0) {
    throw new HttpError(404, 'not_found', spotId !== undefined ? 'Deze plek bestaat niet.' : 'Dit veld bestaat niet.');
  }
  return ids;
}
