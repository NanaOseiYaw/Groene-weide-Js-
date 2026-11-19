// Photo management for staff (mounted under /api/admin, behind requireStaff).
//   GET    /api/admin/spots/:id/photos        photos of one spot
//   POST   /api/admin/spots/:id/photos        upload (multipart form: "photo" file + "altText")
//   PATCH  /api/admin/photos/:id              { altText }
//   POST   /api/admin/photos/:id/move         { direction: -1 | 1 }
//   DELETE /api/admin/photos/:id
import express from 'express';
import multer from 'multer';
import { HttpError } from '../../lib/errors.js';
import { requireInteger } from '../../lib/validate.js';
import { MAX_PHOTO_BYTES, addPhoto, deletePhoto, listPhotos, movePhoto, updateAltText } from './photos.service.js';

export function createPhotosRouter({ db, config }) {
  const router = express.Router();
  const folder = config.spotPhotosFolder;

  // Keep the upload in memory (max 5 MB) so its content can be checked before anything is written to disk.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 } }).single('photo');
  const receivePhoto = (req, res, next) => upload(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      const message = 'De foto is groter dan 5 MB. Kies een kleinere foto.';
      return next(new HttpError(422, 'validation_failed', message, { photo: message }));
    }
    if (error instanceof multer.MulterError) {
      return next(new HttpError(400, 'invalid_request', 'Stuur één foto mee in het veld "photo".'));
    }
    next(error);
  });

  router.get('/spots/:id/photos', (req, res) => {
    res.json({ photos: listPhotos(db, requireInteger(req.params.id, 'Het nummer van de plek')) });
  });

  router.post('/spots/:id/photos', receivePhoto, async (req, res) => {
    const spotId = requireInteger(req.params.id, 'Het nummer van de plek');
    const photo = await addPhoto(db, { spotId, file: req.file, altText: req.body?.altText, folder });
    res.status(201).json({ photo });
  });

  router.patch('/photos/:id', (req, res) => {
    updateAltText(db, { photoId: requireInteger(req.params.id, 'Het nummer van de foto'), altText: req.body?.altText });
    res.status(204).end();
  });

  router.post('/photos/:id/move', (req, res) => {
    movePhoto(db, { photoId: requireInteger(req.params.id, 'Het nummer van de foto'), direction: req.body?.direction });
    res.status(204).end();
  });

  router.delete('/photos/:id', async (req, res) => {
    await deletePhoto(db, { photoId: requireInteger(req.params.id, 'Het nummer van de foto'), folder });
    res.status(204).end();
  });

  return router;
}
