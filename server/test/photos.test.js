// Photo management: upload checks, alt text, order, delete, and guests seeing the photo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createTestConfig, startTestServer } from './helpers.js';

/** The smallest bytes that look like a PNG (signature + start of the header). */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20, 1)]);

function photoForm(bytes, altText, fileName = 'foto.png') {
  const form = new FormData();
  if (altText !== undefined) form.append('altText', altText);
  if (bytes) form.append('photo', new Blob([bytes]), fileName);
  return form;
}

describe('photo management', () => {
  let server;
  let cookie;
  let uploads;
  const upload = (spotId, form) => server.request(`/api/admin/spots/${spotId}/photos`, { method: 'POST', cookie, body: form });

  before(async () => {
    uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'groene-weide-uploads-'));
    server = await startTestServer({ config: createTestConfig({ UPLOADS_FOLDER: uploads }) });
    cookie = await server.signIn();
  });
  after(async () => {
    await server.close();
    fs.rmSync(uploads, { recursive: true, force: true });
  });

  it('stores a real photo under a new random name and guests see it straight away', async () => {
    const { status, body } = await upload(41, photoForm(PNG, 'Camperplek C01 met grindstrook', '../../evil name.png'));
    assert.equal(status, 201);
    assert.match(body.photo.url, /^\/uploads\/spots\/[0-9a-f]{32}\.png$/); // the uploader's file name is never used
    assert.equal(body.photo.sortOrder, 2); // after the seed placeholder

    const served = await fetch(server.baseUrl + body.photo.url);
    assert.equal(served.status, 200);
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG);

    const guestList = (await server.request('/api/spots?type=Camper&start=2027-05-01&end=2027-05-02')).body.spots;
    assert.equal(guestList.find((s) => s.name === 'C01').firstPhoto.altText, 'Camperplek C01 met grindstrook');
  });

  it('checks the content, not the file name', async () => {
    const fake = await upload(41, photoForm(Buffer.from('dit is geen foto, alleen tekst met een .jpg-naam'), 'Nep', 'foto.jpg'));
    assert.equal(fake.status, 422);
    assert.deepEqual(fake.body.error.fields, { photo: 'Dit is geen jpg-, png- of webp-foto.' });
    assert.equal((await upload(41, photoForm(WEBP, 'Een webp-foto', 'foto.bin'))).status, 201);
  });

  it('refuses photos larger than 5 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const { status, body } = await upload(41, photoForm(big, 'Te groot'));
    assert.equal(status, 422);
    assert.equal(body.error.fields.photo, 'De foto is groter dan 5 MB. Kies een kleinere foto.');
  });

  it('requires a description (alt text) and a photo', async () => {
    assert.deepEqual((await upload(41, photoForm(PNG, '  '))).body.error.fields, { altText: 'Beschrijf wat er op de foto staat (alt-tekst).' });
    assert.deepEqual((await upload(41, photoForm(null, 'Geen bestand'))).body.error.fields, { photo: 'Kies een foto.' });
    assert.equal((await upload(999, photoForm(PNG, 'Plek bestaat niet'))).status, 404);
  });

  it('changes the description, the order, and deletes a photo with its file', async () => {
    const first = (await upload(42, photoForm(PNG, 'Eerste'))).body.photo;
    const second = (await upload(42, photoForm(PNG, 'Tweede'))).body.photo;

    assert.equal((await server.request(`/api/admin/photos/${first.id}`, { method: 'PATCH', cookie, body: { altText: 'Eerste, nu beter beschreven' } })).status, 204);
    assert.equal((await server.request(`/api/admin/photos/${second.id}/move`, { method: 'POST', cookie, body: { direction: -1 } })).status, 204);
    const photos = (await server.request('/api/admin/spots/42/photos', { cookie })).body.photos;
    assert.deepEqual(photos.map((p) => [p.altText, p.sortOrder]), [['Tweede', 1], ['Eerste, nu beter beschreven', 2]]);

    const file = path.join(uploads, 'spots', path.basename(second.url));
    assert.ok(fs.existsSync(file));
    assert.equal((await server.request(`/api/admin/photos/${second.id}`, { method: 'DELETE', cookie })).status, 204);
    assert.ok(!fs.existsSync(file));
    assert.equal((await server.request('/api/admin/spots/42/photos', { cookie })).body.photos.length, 1);
    assert.equal((await server.request(`/api/admin/photos/${second.id}`, { method: 'DELETE', cookie })).status, 404);
  });

  it('does not serve anything outside the photo folder', async () => {
    assert.equal((await fetch(`${server.baseUrl}/uploads/spots/..%2F..%2Fpackage.json`)).status, 404);
  });
});
