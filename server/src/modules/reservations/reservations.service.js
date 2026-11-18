// Storing and paying for reservations. Port of Services/ReservationService.cs.
//
// No double bookings (business rule 4): the "is this spot still free?" check and the INSERT run
// together in ONE transaction that takes the database write lock first (BEGIN IMMEDIATE).
// A second booking for the same spot waits until the first has finished, and then sees it.
// Within one Node process better-sqlite3 runs each transaction to completion before anything
// else, and between processes SQLite's write lock does the same job.
import crypto from 'node:crypto';
import { HttpError } from '../../lib/errors.js';
import { daysBetween, isIsoDate } from '@groene-weide/shared/dates';
import { euro, formatDate, formatLongDate, formatNights, reservationNumber, SPOT_TYPE_LABELS } from '@groene-weide/shared/format';
import { SPOT_TYPES, text } from '../../lib/validate.js';
import { checkPeriodDates } from '../availability/availability.service.js';
import { priceStay } from '../pricing/price-rules.js';
import { BOOKABLE, BOOKABLE_FOR_STAFF, FREE_BETWEEN } from '../spots/spot-queries.js';

/** Step 3: own camping gear. Renting comes later. Stored as a note on the reservation. */
export const EQUIPMENT_NOTES = Object.freeze({ OwnTent: 'Eigen tent', OwnCaravan: 'Eigen caravan' });

const SPOT_TAKEN_MESSAGE = 'Deze plek is net door iemand anders gereserveerd of niet meer beschikbaar. Kies een andere plek; de lijst is bijgewerkt.';
const PHONE = /^\+?[0-9][0-9 \-()]{8,18}[0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Booking step 6: stores a guest's reservation with payment status "Open".
 * Checks the input, then checks again (inside the transaction) that the spot is free and bookable
 * for the whole period. The price is always calculated here on the server, never taken from the browser.
 * @returns {{ reservation: object, bookingToken: string }} the token is needed to pay (see payReservation)
 */
export function createGuestReservation(db, { input, today, settings }) {
  const booking = readGuestBooking(input ?? {});
  const datesProblem = checkPeriodDates({ start: booking.start, end: booking.end, today, settings });
  if (datesProblem) throw new HttpError(422, 'invalid_period', datesProblem);

  const bookingToken = crypto.randomBytes(32).toString('base64url');
  const id = insertReservationIfFree(db, {
    spotId: booking.spotId,
    spotType: booking.type,
    start: booking.start,
    end: booking.end,
    forStaff: false,
    values: {
      guestName: booking.guest.name,
      guestEmail: booking.guest.email,
      guestPhone: booking.guest.phone,
      createdBy: 'Guest',
      isFriendOfBert: 0,
      notes: booking.equipment ? EQUIPMENT_NOTES[booking.equipment] : null,
      bookingTokenHash: hashToken(bookingToken),
    },
  });

  return { reservation: getReservationSummary(db, id), bookingToken };
}

/**
 * Pays for a guest reservation (simulated), marks it "Paid" and sends the confirmation e-mail.
 * If the payment fails, the reservation is cancelled so the spot is free again.
 * Paying twice is harmless: an already paid reservation is returned as it is.
 *
 * @param {Set<number>} paymentsInProgress  ids being paid right now, to refuse a double click
 */
export async function payReservation(db, { id, bookingToken, payment, email, campsiteName, logger, paymentsInProgress }) {
  const row = db.prepare('SELECT id, status, payment_status, total_price_cents, booking_token_hash FROM reservations WHERE id = ?').get(id);
  // Unknown id and wrong token get the same answer, so nobody can find out which ids exist.
  if (!row || !tokenMatches(bookingToken, row.booking_token_hash)) {
    throw new HttpError(404, 'not_found', 'Deze reservering bestaat niet (meer).');
  }
  if (row.status === 'Cancelled') {
    throw new HttpError(409, 'reservation_cancelled', 'Deze reservering is geannuleerd. Kies opnieuw een plek om te reserveren.');
  }
  if (row.payment_status === 'Paid') return getReservationSummary(db, id);
  if (paymentsInProgress.has(id)) {
    throw new HttpError(409, 'payment_in_progress', 'De betaling wordt al verwerkt. Even geduld.');
  }

  paymentsInProgress.add(id);
  let result;
  try {
    result = await payment.pay({ reservationId: id, amountCents: row.total_price_cents });
  } catch (error) {
    logger.error(`Payment of reservation ${id} failed with an error`, error);
    result = { success: false };
  } finally {
    paymentsInProgress.delete(id);
  }

  if (!result?.success) {
    // Spot free again; nothing is ever deleted.
    db.prepare("UPDATE reservations SET status = 'Cancelled' WHERE id = ?").run(id);
    throw new HttpError(402, 'payment_failed', 'De betaling is niet gelukt. Er is niets afgeschreven. Probeer het opnieuw.');
  }

  const { changes } = db.prepare("UPDATE reservations SET payment_status = 'Paid' WHERE id = ? AND status = 'Confirmed'").run(id);
  if (changes === 0) {
    // Cancelled by staff while the payment was running. Should be refunded by hand.
    logger.warn(`Reservation ${id} was paid but had been cancelled in the meantime`);
    throw new HttpError(409, 'reservation_cancelled', 'Deze reservering is intussen geannuleerd. Neem contact op met de camping.');
  }

  await sendConfirmation(db, { id, email, campsiteName, logger });
  return getReservationSummary(db, id);
}

/**
 * Confirmation with the invoice to the guest (never to Bert or staff, rule 7).
 * A failing e-mail is logged but never changes the reservation.
 */
export async function sendConfirmation(db, { id, email, campsiteName, logger }) {
  const r = db.prepare(`
    SELECT r.*, s.name AS spot_name, s.type AS spot_type, s.field_name, s.price_per_night_cents
      FROM reservations r JOIN spots s ON s.id = r.spot_id WHERE r.id = ?`).get(id);
  if (!r?.guest_email) return;

  const { lines } = priceStay(db, { spotType: r.spot_type, pricePerNightCents: r.price_per_night_cents, start: r.start_date, end: r.end_date });
  const invoiceLine = (label, amount, extra = '') => `  ${label.padEnd(30)}${amount.padStart(10)}${extra}`;
  const body = [
    `Beste ${r.guest_name},`,
    '',
    `Bedankt voor je reservering bij ${campsiteName}. Hieronder staan je gegevens.`,
    '',
    `Reserveringsnummer: ${reservationNumber(r.id)}`,
    `Plek:               ${r.spot_name} (${SPOT_TYPE_LABELS[r.spot_type]}, ${r.field_name})`,
    `Aankomst:           ${formatLongDate(r.start_date)}`,
    `Vertrek:            ${formatLongDate(r.end_date)}`,
    ...(r.notes ? [`Opmerking:          ${r.notes}`] : []),
    '',
    'FACTUUR',
    ...lines.map((line) => invoiceLine(
      `Nacht ${formatDate(line.night)}`,
      euro(line.priceCents),
      line.discountPercentage ? `  (deal ${Math.round(line.discountPercentage)}% korting)` : '',
    )),
    invoiceLine(`Totaal (${formatNights(daysBetween(r.start_date, r.end_date))})`, euro(r.total_price_cents)),
    `  Status: ${r.payment_status === 'Paid' ? 'betaald' : 'nog te betalen'}`,
    '',
    'Tot ziens op de camping!',
    'Bert en Anita',
  ].join('\n');

  try {
    await email.send({ to: r.guest_email, subject: `Bevestiging reservering ${reservationNumber(r.id)}`, text: body });
  } catch (error) {
    logger.error(`Confirmation e-mail for reservation ${id} could not be sent`, error);
  }
}

/**
 * Checks inside one write transaction that the spot is free in [start, end), then inserts.
 * forStaff = false: only bookable spots (not out of use, not a reserve tent).
 * forStaff = true:  reserve tents too (phone bookings, phase 3), never spots that are out of use.
 * Throws HttpError 409 "spot_taken" when the spot is no longer available.
 * @returns {number} id of the new reservation
 */
export function insertReservationIfFree(db, { spotId, spotType, start, end, forStaff, values }) {
  const book = db.transaction(() => {
    const spot = db
      .prepare(`SELECT s.id, s.type, s.price_per_night_cents FROM spots s
                 WHERE s.id = @spotId AND ${forStaff ? BOOKABLE_FOR_STAFF : BOOKABLE} AND ${FREE_BETWEEN}`)
      .get({ spotId, start, end });
    if (!spot || spot.type !== spotType) {
      throw new HttpError(409, 'spot_taken', SPOT_TAKEN_MESSAGE);
    }

    const { totalCents } = priceStay(db, { spotType: spot.type, pricePerNightCents: spot.price_per_night_cents, start, end });
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO reservations (spot_id, start_date, end_date, guest_name, guest_email, guest_phone, status,
                                created_by, is_friend_of_bert, total_price_cents, payment_status, notes, booking_token_hash)
      VALUES (@spotId, @start, @end, @guestName, @guestEmail, @guestPhone, 'Confirmed',
              @createdBy, @isFriendOfBert, @totalCents, 'Open', @notes, @bookingTokenHash)`)
      .run({ bookingTokenHash: null, ...values, spotId, start, end, totalCents });
    return Number(lastInsertRowid);
  });

  try {
    // .immediate(): take the write lock BEFORE the check, so no other writer can slip in between.
    return book.immediate();
  } catch (error) {
    if (error.code === 'SQLITE_BUSY') {
      // Another process kept the database busy for longer than the busy timeout.
      throw new HttpError(503, 'busy', 'Het opslaan lukte niet, omdat er net iemand anders aan het boeken was. Probeer het nog een keer.');
    }
    throw error;
  }
}

/** What the guest may see of a reservation (after creating it and after paying). */
export function getReservationSummary(db, id) {
  const r = db.prepare(`
    SELECT r.id, r.status, r.payment_status, r.start_date, r.end_date, r.total_price_cents, r.guest_name, r.guest_email, r.notes,
           s.id AS spot_id, s.name AS spot_name, s.type AS spot_type, s.field_name
      FROM reservations r JOIN spots s ON s.id = r.spot_id WHERE r.id = ?`).get(id);
  return {
    id: r.id,
    number: reservationNumber(r.id),
    status: r.status,
    paymentStatus: r.payment_status,
    spot: { id: r.spot_id, name: r.spot_name, type: r.spot_type, fieldName: r.field_name },
    start: r.start_date,
    end: r.end_date,
    nights: daysBetween(r.start_date, r.end_date),
    totalPriceCents: r.total_price_cents,
    notes: r.notes,
    guest: { name: r.guest_name, email: r.guest_email },
  };
}

/**
 * Reads and checks the request body of a guest booking.
 * Missing choices (spot, type, dates) are a 422 "missing_choice": the guest has to go back.
 * Wrong guest details are a 422 "validation_failed" with a Dutch message per field
 * (same rules as GuestDetailsForm.cs).
 */
function readGuestBooking(input) {
  const spotId = Number(input.spotId);
  const { type, start, end, equipment } = input;
  if (!Number.isInteger(spotId) || spotId < 1 || !SPOT_TYPES.includes(type) || !isIsoDate(start) || !isIsoDate(end)) {
    throw new HttpError(422, 'missing_choice', 'Er ontbreekt nog een keuze. Ga terug en kies een plek en datums.');
  }
  if (type === 'TentCaravan' && !Object.hasOwn(EQUIPMENT_NOTES, equipment)) {
    throw new HttpError(422, 'missing_choice', 'Kies eerst of je een eigen tent of een eigen caravan meeneemt.');
  }

  const guest = { name: text(input.guest?.name), email: text(input.guest?.email), phone: text(input.guest?.phone) };
  const fields = {};
  if (!guest.name) fields.name = 'Vul je naam in.';
  else if (guest.name.length > 120) fields.name = 'Je naam mag maximaal 120 tekens lang zijn.';

  if (!guest.email) fields.email = 'Vul je e-mailadres in. Daar sturen we de bevestiging naartoe.';
  else if (guest.email.length > 190) fields.email = 'Dit e-mailadres is te lang.';
  else if (!EMAIL.test(guest.email)) fields.email = 'Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl';

  if (!guest.phone) fields.phone = 'Vul je telefoonnummer in, zodat we je kunnen bellen als dat nodig is.';
  else if (!PHONE.test(guest.phone)) fields.phone = 'Dit telefoonnummer klopt niet. Bijvoorbeeld: 06 12345678';

  if (Object.keys(fields).length > 0) {
    throw new HttpError(422, 'validation_failed', 'Niet alle gegevens zijn goed ingevuld.', fields);
  }
  return { spotId, type, start, end, equipment: type === 'TentCaravan' ? equipment : null, guest };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Compares in constant time, so the response time does not reveal how much of a token was right. */
function tokenMatches(token, storedHash) {
  if (typeof token !== 'string' || !token || !storedHash) return false;
  return crypto.timingSafeEqual(Buffer.from(hashToken(token)), Buffer.from(storedHash));
}
