// Spots for guests (Feature 4). Port of Services/SpotService.cs.
// Always uses the central rules from spot-queries.js, so spots that are taken out of use,
// held as reserve tents or occupied are never shown to guests.
import { daysBetween } from '../../lib/dates.js';
import { SPOT_TYPE_LABELS } from '../../lib/format.js';
import { SPOT_TYPES } from '../../lib/validate.js';
import { priceStay } from '../pricing/price-rules.js';
import { BOOKABLE, FREE_BETWEEN, REAL_PHOTO, photoUrl } from './spot-queries.js';

/** Price per night per type (booking step 2 and the home page). Only types that have bookable spots. */
export function getSpotTypes(db) {
  const rows = db.prepare(`
    SELECT s.type, MIN(s.field_name) AS fieldName, MIN(s.price_per_night_cents) AS pricePerNightCents
      FROM spots s WHERE ${BOOKABLE} GROUP BY s.type`).all();
  return SPOT_TYPES
    .map((type) => rows.find((row) => row.type === type))
    .filter(Boolean)
    .map((row) => ({ type: row.type, label: SPOT_TYPE_LABELS[row.type], fieldName: row.fieldName, pricePerNightCents: row.pricePerNightCents }));
}

/** Available spots of one type for the whole period, each with its first real photo (or null). */
export function listAvailableSpots(db, { type, start, end }) {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.field_name, s.capacity, s.price_per_night_cents, s.distance_toilet_m, s.amenities,
           (SELECT json_object('id', p.id, 'filename', p.filename, 'altText', p.alt_text)
              FROM spot_photos p WHERE p.spot_id = s.id AND ${REAL_PHOTO}
             ORDER BY p.sort_order, p.id LIMIT 1) AS first_photo
      FROM spots s
     WHERE ${BOOKABLE} AND s.type = @type AND ${FREE_BETWEEN}
     ORDER BY s.name`).all({ type, start, end });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    fieldName: row.field_name,
    capacity: row.capacity,
    pricePerNightCents: row.price_per_night_cents,
    distanceToiletM: row.distance_toilet_m,
    amenities: JSON.parse(row.amenities),
    firstPhoto: row.first_photo ? toPhoto(JSON.parse(row.first_photo)) : null,
  }));
}

/**
 * All details of one spot for the pop-up, with all real photos and the total price for the period.
 * Returns null when the spot is not (or no longer) bookable in that period.
 */
export function getSpotDetail(db, { id, start, end }) {
  const spot = db.prepare(`SELECT s.* FROM spots s WHERE s.id = @id AND ${BOOKABLE} AND ${FREE_BETWEEN}`).get({ id, start, end });
  if (!spot) return null;

  const photos = db
    .prepare(`SELECT p.id, p.filename, p.alt_text AS altText FROM spot_photos p WHERE p.spot_id = ? AND ${REAL_PHOTO} ORDER BY p.sort_order, p.id`)
    .all(id)
    .map(toPhoto);
  const { totalCents } = priceStay(db, { spotType: spot.type, pricePerNightCents: spot.price_per_night_cents, start, end });

  return {
    id: spot.id,
    name: spot.name,
    type: spot.type,
    fieldName: spot.field_name,
    description: spot.description,
    capacity: spot.capacity,
    pricePerNightCents: spot.price_per_night_cents,
    distanceToiletM: spot.distance_toilet_m,
    distancePoolM: spot.distance_pool_m,
    amenities: JSON.parse(spot.amenities),
    photos,
    nights: daysBetween(start, end),
    totalPriceCents: totalCents,
  };
}

function toPhoto({ id, filename, altText }) {
  return { id, url: photoUrl(filename), altText };
}
