// Availability for the colourful calendar (Feature 3). Port of Services/AvailabilityService.cs.
// Per month the reservations are read in one query and counted per day in JavaScript.
import { addDays, daysBetween, eachNight, firstOfNextMonth, makeDate } from '@groene-weide/shared/dates';
import { formatDayMonth } from '@groene-weide/shared/format';
import { dealFor, discountedCents, getDeals } from '../pricing/price-rules.js';
import { BOOKABLE, BOOKABLE_FOR_STAFF } from '../spots/spot-queries.js';

/** Status of a calendar day. The order is the priority: closed wins over full, and so on. */
export const DAY_STATUS = Object.freeze({
  Closed: 'Closed',
  Full: 'Full',
  AlmostFull: 'AlmostFull',
  Deal: 'Deal',
  Free: 'Free',
});

/** How far around a full period we look for alternative periods (days). */
const ALTERNATIVE_SEARCH_DAYS = 90;
const MAX_ALTERNATIVES = 3;

/**
 * Per day of the month: free spots, status, price and a short Dutch label.
 *
 * @param {object} options
 * @param {string|null} options.type  spot type, or null for all spots (staff view)
 * @param {boolean} [options.includeHeld]  also count reserve tents (staff phone booking)
 * @param {boolean} [options.staffView]  all 60 spots, with check-ins and check-outs, no deals
 */
export function getMonth(db, { type, year, month, today, settings, includeHeld = false, staffView = false }) {
  const first = makeDate(year, month, 1);
  const afterLast = firstOfNextMonth(first);

  // Which spots count? Guests: only bookable spots of this type. Staff: every spot.
  const spotFilter = spotCondition({ type, includeHeld, staffView });
  const spots = db.prepare(`SELECT s.id, s.price_per_night_cents AS price FROM spots s WHERE ${spotFilter}`).all({ type });

  // One query for all reservations touching this month (including departures on the 1st, for the check-outs).
  const reservations = db.prepare(`
    SELECT r.spot_id AS spotId, r.start_date AS start, r.end_date AS end
      FROM reservations r JOIN spots s ON s.id = r.spot_id
     WHERE r.status = 'Confirmed' AND r.start_date < @afterLast AND r.end_date >= @first AND ${spotFilter}`)
    .all({ type, first, afterLast });

  const deals = staffView ? [] : getDeals(db, first, afterLast);
  // All spots of one type have the same price; take the lowest to be safe.
  const basePriceCents = spots.length > 0 ? Math.min(...spots.map((spot) => spot.price)) : 0;

  const days = [];
  for (let date = first; date < afterLast; date = addDays(date, 1)) {
    // Occupied = a reservation that contains the night of `date` (the departure day does not count).
    const occupied = new Set(reservations.filter((r) => r.start <= date && r.end > date).map((r) => r.spotId)).size;
    const totalSpots = spots.length;
    const freeSpots = Math.max(0, totalSpots - occupied);
    const inSeason = settings.isInSeason(date);
    const isPast = date < today;
    const isLastDayOfSeason = date === settings.seasonEndOf(Number(date.slice(0, 4)));
    const deal = type ? dealFor(deals, date, type) : null;
    const status = dayStatus({ inSeason, totalSpots, freeSpots, deal, threshold: settings.almostFullThreshold });

    // A deal price applies on every bookable day with a deal (also when the day is almost full),
    // so the calendar always shows the price the guest will pay.
    const dealApplies = deal !== null && (status === DAY_STATUS.Deal || status === DAY_STATUS.AlmostFull);

    const day = {
      date,
      totalSpots,
      freeSpots,
      status,
      pricePerNightCents: discountedCents(basePriceCents, dealApplies ? deal : null),
      discountPercentage: dealApplies ? deal : null,
      label: isPast && !staffView ? 'voorbij' : labelFor(status, freeSpots),
      // On the last day of the season you cannot arrive (there is no night left), but you can leave.
      selectable: !isPast && !isLastDayOfSeason && [DAY_STATUS.Free, DAY_STATUS.AlmostFull, DAY_STATUS.Deal].includes(status),
      onlyDeparture: !isPast && inSeason && totalSpots > 0 && (isLastDayOfSeason || status === DAY_STATUS.Full),
      isPast,
      inSeason,
    };
    if (staffView) {
      day.checkIns = reservations.filter((r) => r.start === date).length;
      day.checkOuts = reservations.filter((r) => r.end === date).length;
    }
    days.push(day);
  }
  return days;
}

/**
 * Checks a chosen period: departure after arrival, not in the past, within the season, and one
 * spot of this type is free for the WHOLE period (a guest stays on one spot). If not: a Dutch
 * message and at most 3 periods of the same length that do work, closest first.
 * @returns {{ valid: boolean, message: string|null, alternatives: { start: string, end: string, nights: number }[] }}
 */
export function validatePeriod(db, { type, start, end, today, settings, includeHeld = false }) {
  const datesProblem = checkPeriodDates({ start, end, today, settings });
  if (datesProblem) return { valid: false, message: datesProblem, alternatives: [] };

  const nights = daysBetween(start, end);
  const spotIds = db
    .prepare(`SELECT s.id FROM spots s WHERE ${spotCondition({ type, includeHeld })}`)
    .pluck()
    .all({ type });
  const reservations = db.prepare(`
    SELECT spot_id AS spotId, start_date AS start, end_date AS end FROM reservations
     WHERE status = 'Confirmed' AND start_date < @until AND end_date > @from`)
    .all({ from: addDays(start, -ALTERNATIVE_SEARCH_DAYS), until: addDays(end, ALTERNATIVE_SEARCH_DAYS) })
    .filter((r) => spotIds.includes(r.spotId));

  // Is at least one spot free for the whole period [from, until)?
  const anySpotFree = (from, until) =>
    spotIds.some((id) => !reservations.some((r) => r.spotId === id && r.start < until && r.end > from));

  if (anySpotFree(start, end)) return { valid: true, message: null, alternatives: [] };

  // Message: which nights are completely full?
  const fullNights = [...eachNight(start, end)].filter((night) => {
    const occupied = new Set(reservations.filter((r) => r.start <= night && r.end > night).map((r) => r.spotId)).size;
    return occupied >= spotIds.length;
  });
  let message = fullNights.length > 0
    ? `Op ${fullNights.map(formatDayMonth).join(', ')} is alles vol.`
    : 'Er is geen plek die de hele periode vrij is.';

  // Alternatives: shift the period one day later or earlier at a time, closest first.
  const alternatives = [];
  for (let offset = 1; offset <= ALTERNATIVE_SEARCH_DAYS && alternatives.length < MAX_ALTERNATIVES; offset++) {
    for (const shift of [offset, -offset]) {
      const altStart = addDays(start, shift);
      const altEnd = addDays(altStart, nights);
      if (alternatives.length < MAX_ALTERNATIVES && altStart >= today && settings.isStayInSeason(altStart, altEnd) && anySpotFree(altStart, altEnd)) {
        alternatives.push({ start: altStart, end: altEnd, nights });
      }
    }
  }

  message += alternatives.length > 0
    ? ' Deze periodes van dezelfde lengte zijn wel vrij:'
    : ' We vonden geen andere periode van dezelfde lengte. Probeer minder nachten.';
  return { valid: false, message, alternatives };
}

/**
 * The date rules every booking must follow. Returns a Dutch message, or null when the dates are fine.
 * Used by the calendar check and again when a reservation is saved.
 */
export function checkPeriodDates({ start, end, today, settings }) {
  if (end <= start) return 'De vertrekdatum moet na de aankomstdatum liggen.';
  if (start < today) return 'Deze aankomstdatum is al voorbij. Kies een datum vanaf vandaag.';
  if (!settings.isStayInSeason(start, end)) {
    return `De camping is open van ${settings.seasonText}. Kies datums binnen die periode.`;
  }
  return null;
}

/** SQL condition for the spots that count (uses the named parameter @type when a type is given). */
function spotCondition({ type, includeHeld = false, staffView = false }) {
  const base = staffView ? '1 = 1' : includeHeld ? BOOKABLE_FOR_STAFF : BOOKABLE;
  return type ? `${base} AND s.type = @type` : base;
}

function dayStatus({ inSeason, totalSpots, freeSpots, deal, threshold }) {
  if (!inSeason || totalSpots === 0) return DAY_STATUS.Closed;
  if (freeSpots === 0) return DAY_STATUS.Full;
  if (freeSpots <= threshold) return DAY_STATUS.AlmostFull;
  if (deal !== null) return DAY_STATUS.Deal;
  return DAY_STATUS.Free;
}

/** Short Dutch text shown next to the colour: never colour alone (accessibility). */
function labelFor(status, freeSpots) {
  switch (status) {
    case DAY_STATUS.Closed: return 'gesloten';
    case DAY_STATUS.Full: return 'vol';
    case DAY_STATUS.AlmostFull: return freeSpots === 1 ? 'nog 1 plek' : `nog ${freeSpots} plekken`;
    case DAY_STATUS.Deal: return 'deal';
    default: return 'vrij';
  }
}
