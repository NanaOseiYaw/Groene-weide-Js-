// Data and actions for the staff section: daily overview, reservation list, cancel,
// "needs to be moved" and phone bookings. Port of AdminService.cs and parts of ReservationService.cs.
// Only used behind requireStaff: guests must never see this data.
import { HttpError } from '../../lib/errors.js';
import { daysBetween, isIsoDate } from '@groene-weide/shared/dates';
import { reservationNumber } from '@groene-weide/shared/format';
import { EMAIL_PATTERN, PHONE_PATTERN } from '@groene-weide/shared/validation';
import { SPOT_TYPES, text } from '../../lib/validate.js';
import { checkPeriodDates } from '../availability/availability.service.js';
import { insertReservationIfFree } from '../reservations/reservations.service.js';
import { FREE_BETWEEN, BOOKABLE_FOR_STAFF } from '../spots/spot-queries.js';

const STATUSES = ['Confirmed', 'Cancelled'];

/** Everything one row of the reservation list needs. */
const ROW_SELECT = `
  SELECT r.id, r.spot_id, s.name AS spot_name, s.type AS spot_type, r.guest_name, r.start_date, r.end_date,
         r.status, r.guest_phone, r.guest_email, r.is_friend_of_bert, r.payment_status, r.needs_move,
         r.created_by, r.notes, r.total_price_cents, r.created_at
    FROM reservations r JOIN spots s ON s.id = r.spot_id`;

/** Check-ins, check-outs, occupied spots and occupancy on one day (all 60 spots). */
export function getDayStats(db, date) {
  const count = (sql, ...params) => db.prepare(sql).pluck().get(...params);
  const checkIns = count("SELECT COUNT(*) FROM reservations WHERE status = 'Confirmed' AND start_date = ?", date);
  const checkOuts = count("SELECT COUNT(*) FROM reservations WHERE status = 'Confirmed' AND end_date = ?", date);
  // Occupied = the night of `date` is part of the stay.
  const occupiedSpots = count(
    "SELECT COUNT(DISTINCT spot_id) FROM reservations WHERE status = 'Confirmed' AND start_date <= ? AND end_date > ?",
    date,
    date,
  );
  const totalSpots = count('SELECT COUNT(*) FROM spots');
  return {
    date,
    checkIns,
    checkOuts,
    occupiedSpots,
    totalSpots,
    occupancyPercent: totalSpots === 0 ? 0 : Math.round((occupiedSpots * 100) / totalSpots),
  };
}

/** Who arrives and who leaves on this day (confirmed reservations), sorted by spot. */
export function getDayLists(db, date) {
  const rows = (column) => db
    .prepare(`${ROW_SELECT} WHERE r.status = 'Confirmed' AND r.${column} = ? ORDER BY s.name`)
    .all(date)
    .map(toRow);
  return { arrivals: rows('start_date'), departures: rows('end_date') };
}

/**
 * The reservation list with optional filters. The page sorts the rows itself (by any column).
 *   search  part of the guest name or the spot code (e.g. "vries" or "T0")
 *   from    only reservations that end on or after this day
 *   to      only reservations that start on or before this day
 *   status  'Confirmed' | 'Cancelled' | undefined (all)
 */
export function listReservations(db, { search, from, to, status } = {}) {
  const conditions = [];
  const params = {};
  if (search) {
    // LIKE with the user's text as a parameter (never pasted into the SQL). % and _ are escaped,
    // so they are searched for literally instead of acting as wildcards.
    params.pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push("(r.guest_name LIKE @pattern ESCAPE '\\' OR s.name LIKE @pattern ESCAPE '\\')");
  }
  if (from) { conditions.push('r.end_date >= @from'); params.from = from; }
  if (to) { conditions.push('r.start_date <= @to'); params.to = to; }
  if (status) { conditions.push('r.status = @status'); params.status = status; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`${ROW_SELECT} ${where} ORDER BY r.start_date, s.name`).all(params).map(toRow);
}

/** Reads the list filters from the query string (400 when a value is invalid). */
export function readReservationFilter(query) {
  const filter = { search: text(query.search) || undefined };
  for (const key of ['from', 'to']) {
    if (query[key]) {
      if (!isIsoDate(query[key])) throw new HttpError(400, 'invalid_request', 'Kies een geldige datum.');
      filter[key] = query[key];
    }
  }
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw new HttpError(400, 'invalid_request', 'Kies een geldige status.');
    filter.status = query.status;
  }
  return filter;
}

/** Confirmed reservations on a spot that was taken out of use: the "Moet verplaatst worden" list. */
export function getNeedsMove(db) {
  return db.prepare(`${ROW_SELECT} WHERE r.needs_move = 1 AND r.status = 'Confirmed' ORDER BY r.start_date, s.name`).all().map(toRow);
}

/**
 * Cancels a reservation. Nothing is deleted: the status becomes Cancelled and the spot is free again.
 * Throws 404 when the reservation does not exist.
 */
export function cancelReservation(db, id) {
  const { changes } = db.prepare("UPDATE reservations SET status = 'Cancelled', needs_move = 0 WHERE id = ?").run(id);
  if (changes === 0) throw new HttpError(404, 'not_found', 'Deze reservering bestaat niet (meer).');
  return getReservationRow(db, id);
}

export function getReservationRow(db, id) {
  const row = db.prepare(`${ROW_SELECT} WHERE r.id = ?`).get(id);
  return row ? toRow(row) : null;
}

/** Staff phone booking: free spots of this type in the period, reserve tents included, spots out of use never. */
export function listFreeSpotsForStaff(db, { type, start, end }) {
  return db
    .prepare(`SELECT s.id, s.name, s.is_held FROM spots s WHERE ${BOOKABLE_FOR_STAFF} AND s.type = @type AND ${FREE_BETWEEN} ORDER BY s.name`)
    .all({ type, start, end })
    .map((spot) => ({ id: spot.id, name: spot.name, isHeld: spot.is_held === 1 }));
}

/**
 * A phone booking entered by staff (also for friends of Bert). No payment step: payment stays "Open".
 * Reserve tents are allowed; spots taken out of use are not. Same overlap check and transaction as a
 * guest booking. Returns the new row; the caller sends a confirmation only when there is an e-mail address.
 */
export function createManualReservation(db, { input, today, settings }) {
  const booking = readManualBooking(input ?? {});
  const datesProblem = checkPeriodDates({ start: booking.start, end: booking.end, today, settings });
  if (datesProblem) throw new HttpError(422, 'invalid_period', datesProblem);

  const id = insertReservationIfFree(db, {
    spotId: booking.spotId,
    spotType: booking.type,
    start: booking.start,
    end: booking.end,
    forStaff: true,
    values: {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      createdBy: 'Staff',
      isFriendOfBert: booking.isFriendOfBert ? 1 : 0,
      notes: booking.notes,
    },
  });
  return getReservationRow(db, id);
}

/** Same rules and Dutch messages as ManualReservationForm.cs. All problems at once, per field. */
function readManualBooking(input) {
  const fields = {};
  const type = input.type;
  if (!SPOT_TYPES.includes(type)) fields.type = 'Kies het type plek.';
  if (!isIsoDate(input.start)) fields.start = 'Kies een aankomstdatum in de kalender.';
  if (!isIsoDate(input.end)) fields.end = 'Kies een vertrekdatum in de kalender.';
  const spotId = Number(input.spotId);
  if (!Number.isInteger(spotId) || spotId < 1) fields.spotId = 'Kies een plek.';

  const guestName = text(input.guestName);
  if (!guestName) fields.guestName = 'Vul de naam van de gast in.';
  else if (guestName.length > 120) fields.guestName = 'De naam mag maximaal 120 tekens lang zijn.';

  const guestPhone = text(input.guestPhone);
  if (!guestPhone) fields.guestPhone = 'Vul een telefoonnummer in.';
  else if (!PHONE_PATTERN.test(guestPhone)) fields.guestPhone = 'Dit telefoonnummer klopt niet. Bijvoorbeeld: 06 12345678';

  const guestEmail = text(input.guestEmail) || null; // optional
  if (guestEmail && guestEmail.length > 190) fields.guestEmail = 'Dit e-mailadres is te lang.';
  else if (guestEmail && !EMAIL_PATTERN.test(guestEmail)) fields.guestEmail = 'Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl';

  const notes = text(input.notes) || null;
  if (notes && notes.length > 1000) fields.notes = 'De opmerking is te lang (maximaal 1000 tekens).';

  if (Object.keys(fields).length > 0) {
    throw new HttpError(422, 'validation_failed', 'Niet alle gegevens zijn goed ingevuld.', fields);
  }
  return { type, start: input.start, end: input.end, spotId, guestName, guestPhone, guestEmail, notes, isFriendOfBert: input.isFriendOfBert === true };
}

/** One row of the spreadsheet-like list, as the frontend receives it. */
function toRow(r) {
  return {
    id: r.id,
    number: reservationNumber(r.id),
    spotId: r.spot_id,
    spotName: r.spot_name,
    spotType: r.spot_type,
    guestName: r.guest_name,
    start: r.start_date,
    end: r.end_date,
    nights: daysBetween(r.start_date, r.end_date),
    status: r.status,
    phone: r.guest_phone,
    email: r.guest_email,
    isFriendOfBert: r.is_friend_of_bert === 1,
    paymentStatus: r.payment_status,
    needsMove: r.needs_move === 1,
    createdBy: r.created_by,
    notes: r.notes,
    totalPriceCents: r.total_price_cents,
    createdAt: r.created_at,
  };
}
