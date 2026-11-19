// Price rules (business rule 6): every night costs the spot's price per night,
// with a discount on deal days ("blue days"). Port of Services/PriceRules.cs.
// Kept in one place, so the calendar, the spot pop-up, the summary and the invoice
// always show the same amount. All amounts are whole cents.
import { eachNight } from '@groene-weide/shared/dates';

/** Price after a percentage discount, rounded to whole cents. 2500 with 15 % → 2125. */
export function discountedCents(cents, percentage) {
  return percentage > 0 ? Math.round((cents * (100 - percentage)) / 100) : cents;
}

/**
 * The highest discount that applies to this day and spot type, or null.
 * A deal without a spot type applies to every type.
 */
export function dealFor(deals, date, spotType) {
  const matching = deals
    .filter((deal) => deal.date === date && (deal.spotType === null || deal.spotType === spotType))
    .map((deal) => deal.percentage);
  return matching.length > 0 ? Math.max(...matching) : null;
}

/** Deal days in [from, until). */
export function getDeals(db, from, until) {
  return db
    .prepare(`SELECT deal_date AS date, spot_type AS spotType, discount_percentage AS percentage
                FROM deal_days WHERE deal_date >= ? AND deal_date < ?`)
    .all(from, until);
}

/**
 * Price per night for a stay from start up to (not including) end.
 * @returns {{ lines: { night: string, priceCents: number, discountPercentage: number|null }[], totalCents: number }}
 */
export function priceStay(db, { spotType, pricePerNightCents, start, end }) {
  const deals = getDeals(db, start, end);
  const lines = [...eachNight(start, end)].map((night) => {
    const discountPercentage = dealFor(deals, night, spotType);
    return { night, priceCents: discountedCents(pricePerNightCents, discountPercentage), discountPercentage };
  });
  return { lines, totalCents: lines.reduce((sum, line) => sum + line.priceCents, 0) };
}
