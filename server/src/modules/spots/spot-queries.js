// The central rules for "bookable spot" and "overlapping reservation" (business rules 1 and 2),
// as SQL snippets. Port of Data/SpotQueries.cs. Every query that decides whether a spot can be
// booked uses these, so the rules live in one place only.
//
// They assume the spots table is aliased as "s" and use the named parameters @start and @end:
//   db.prepare(`SELECT ... FROM spots s WHERE ${BOOKABLE} AND ${FREE_BETWEEN}`).all({ start, end })

/** Spots that guests may see: not taken out of use and not a reserve tent. */
export const BOOKABLE = 's.is_available = 1 AND s.is_held = 0';

/** Spots staff may book: reserve tents included, spots taken out of use never. */
export const BOOKABLE_FOR_STAFF = 's.is_available = 1';

/**
 * No confirmed reservation on this spot in the period [start, end).
 * Overlap: existing start < new end AND existing end > new start.
 * The departure day itself does not count; it is free again for the next guest.
 */
export const FREE_BETWEEN = `NOT EXISTS (
  SELECT 1 FROM reservations r
   WHERE r.spot_id = s.id
     AND r.status = 'Confirmed'
     AND r.start_date < @end
     AND r.end_date > @start)`;

/** Photos that really exist (seed placeholders have no file; guests see "Foto volgt" instead). */
export const REAL_PHOTO = "p.filename NOT GLOB 'placeholder_*'";

/** URL of an uploaded spot photo (served from data/uploads/spots in phase 3). */
export const photoUrl = (filename) => `/uploads/spots/${encodeURIComponent(filename)}`;
