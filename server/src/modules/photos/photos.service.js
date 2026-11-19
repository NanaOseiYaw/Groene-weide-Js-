// Photos per spot (staff only): upload, alt text, order and delete. Port of SpotPhotoService.cs.
//
// Uploads are secured:
// - only jpg, png and webp, max 5 MB
// - the CONTENT is checked (the first bytes), not the file name, so "virus.exe" renamed to
//   "photo.jpg" is refused
// - the file always gets a new random name; the uploader's file name never ends up in a path
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../../lib/errors.js';
import { text } from '../../lib/validate.js';
import { REAL_PHOTO, photoUrl } from '../spots/spot-queries.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Real photos of one spot, in order (seed placeholders are left out). */
export function listPhotos(db, spotId) {
  return db
    .prepare(`SELECT p.id, p.filename, p.alt_text, p.sort_order FROM spot_photos p WHERE p.spot_id = ? AND ${REAL_PHOTO} ORDER BY p.sort_order, p.id`)
    .all(spotId)
    .map((p) => ({ id: p.id, url: photoUrl(p.filename), altText: p.alt_text, sortOrder: p.sort_order }));
}

/**
 * Stores an uploaded photo. `file` is what multer gives: { buffer, size }.
 * Throws 422 with a Dutch message per field when the photo or the description is not right.
 */
export async function addPhoto(db, { spotId, file, altText, folder }) {
  if (!db.prepare('SELECT 1 FROM spots WHERE id = ?').get(spotId)) {
    throw new HttpError(404, 'not_found', 'Deze plek bestaat niet.');
  }
  const description = checkAltText(altText);
  if (!file) throw invalid('photo', 'Kies een foto.');
  const extension = detectImageType(file.buffer);
  if (!extension) throw invalid('photo', 'Dit is geen jpg-, png- of webp-foto.');

  const filename = `${crypto.randomUUID().replaceAll('-', '')}${extension}`;
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, filename), file.buffer);

  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM spot_photos WHERE spot_id = ?').pluck().get(spotId);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO spot_photos (spot_id, filename, alt_text, sort_order) VALUES (?, ?, ?, ?)')
    .run(spotId, filename, description, nextOrder);
  return { id: Number(lastInsertRowid), url: photoUrl(filename), altText: description, sortOrder: nextOrder };
}

export function updateAltText(db, { photoId, altText }) {
  const description = checkAltText(altText);
  const { changes } = db.prepare('UPDATE spot_photos SET alt_text = ? WHERE id = ?').run(description, photoId);
  if (changes === 0) throw photoGone();
}

/** Moves a photo one place earlier (-1) or later (+1) and renumbers the photos 1, 2, 3, ... */
export function movePhoto(db, { photoId, direction }) {
  if (direction !== -1 && direction !== 1) {
    throw new HttpError(400, 'invalid_request', 'Kies eerder (-1) of later (+1).');
  }
  db.transaction(() => {
    const photo = db.prepare('SELECT spot_id FROM spot_photos WHERE id = ?').get(photoId);
    if (!photo) throw photoGone();
    const ids = db.prepare('SELECT id FROM spot_photos WHERE spot_id = ? ORDER BY sort_order, id').pluck().all(photo.spot_id);
    const index = ids.indexOf(photoId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return; // already first or last
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const renumber = db.prepare('UPDATE spot_photos SET sort_order = ? WHERE id = ?');
    ids.forEach((id, position) => renumber.run(position + 1, id));
  })();
}

/** Removes the photo from the database and its file from the upload folder. */
export async function deletePhoto(db, { photoId, folder }) {
  const photo = db.prepare('SELECT filename FROM spot_photos WHERE id = ?').get(photoId);
  if (!photo) throw photoGone();
  db.prepare('DELETE FROM spot_photos WHERE id = ?').run(photoId);
  // path.basename: only ever a file inside our own folder, never a path outside it.
  await fs.rm(path.join(folder, path.basename(photo.filename)), { force: true });
}

/** Recognises jpg, png and webp by their first bytes ("magic numbers"). Returns the extension or null. */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

function checkAltText(value) {
  const description = text(value);
  if (!description) throw invalid('altText', 'Beschrijf wat er op de foto staat (alt-tekst).');
  if (description.length > 255) throw invalid('altText', 'De beschrijving is te lang (maximaal 255 tekens).');
  return description;
}

function invalid(field, message) {
  return new HttpError(422, 'validation_failed', message, { [field]: message });
}

function photoGone() {
  return new HttpError(404, 'not_found', 'Deze foto bestaat niet meer.');
}
