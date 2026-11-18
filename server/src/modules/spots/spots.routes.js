// Spot endpoints for guests.
//   GET /api/spot-types
//   GET /api/spots?type=Camper&start=2027-07-14&end=2027-07-17
//   GET /api/spots/41?start=2027-07-14&end=2027-07-17
import express from 'express';
import { HttpError } from '../../lib/errors.js';
import { requireInteger, requirePeriod, requireSpotType } from '../../lib/validate.js';
import { getSpotDetail, getSpotTypes, listAvailableSpots } from './spots.service.js';

export function createSpotsRouter({ db }) {
  const router = express.Router();

  router.get('/spot-types', (req, res) => {
    res.json({ spotTypes: getSpotTypes(db) });
  });

  router.get('/spots', (req, res) => {
    const type = requireSpotType(req.query.type);
    const { start, end } = requirePeriod(req.query);
    res.json({ spots: listAvailableSpots(db, { type, start, end }) });
  });

  router.get('/spots/:id', (req, res) => {
    const id = requireInteger(req.params.id, 'Het nummer van de plek');
    const { start, end } = requirePeriod(req.query);
    const spot = getSpotDetail(db, { id, start, end });
    if (!spot) {
      throw new HttpError(404, 'spot_unavailable', 'Deze plek is net door iemand anders gekozen. Kies een andere plek; de lijst is bijgewerkt.');
    }
    res.json({ spot });
  });

  return router;
}
