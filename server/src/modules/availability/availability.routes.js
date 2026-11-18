// Calendar endpoints for guests.
//   GET /api/availability?type=Camper&year=2027&month=7
//   GET /api/availability/check?type=Camper&start=2027-07-14&end=2027-07-17
import express from 'express';
import { requireDate, requireInteger, requireSpotType } from '../../lib/validate.js';
import { getSettings } from '../settings/settings.service.js';
import { getMonth, validatePeriod } from './availability.service.js';

export function createAvailabilityRouter({ db, clock }) {
  const router = express.Router();

  router.get('/availability', (req, res) => {
    const type = requireSpotType(req.query.type);
    const year = requireInteger(req.query.year, 'Het jaar', { min: 2000, max: 2100 });
    const month = requireInteger(req.query.month, 'De maand', { min: 1, max: 12 });
    const days = getMonth(db, { type, year, month, today: clock.today(), settings: getSettings(db) });
    res.json({ type, year, month, days });
  });

  router.get('/availability/check', (req, res) => {
    const type = requireSpotType(req.query.type);
    const start = requireDate(req.query.start, 'De aankomstdatum');
    const end = requireDate(req.query.end, 'De vertrekdatum');
    res.json(validatePeriod(db, { type, start, end, today: clock.today(), settings: getSettings(db) }));
  });

  return router;
}
