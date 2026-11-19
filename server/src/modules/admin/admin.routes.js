// Staff endpoints. Mounted under /api/admin behind requireStaff (see app.js), so every route
// here can assume a signed-in staff member.
//
//   GET  /api/admin/day/:date                     daily overview: numbers, arrivals, departures
//   GET  /api/admin/calendar?year&month           month calendar with numbers for all 60 spots
//   GET  /api/admin/reservations?search&from&to&status
//   POST /api/admin/reservations                  phone booking (no payment step)
//   POST /api/admin/reservations/:id/cancel
//   GET  /api/admin/needs-move                    reservations on spots that are out of use
//   GET  /api/admin/availability?type&year&month  calendar for a phone booking (reserve tents count)
//   GET  /api/admin/availability/check?type&start&end
//   GET  /api/admin/free-spots?type&start&end     free spots for a phone booking, reserve tents included
//   GET  /api/admin/spots?day                     all 60 spots with their status on that day
//   POST /api/admin/spots/:id/unavailable         { reason }
//   POST /api/admin/spots/:id/available
//   POST /api/admin/fields/:fieldName/unavailable { reason }
//   POST /api/admin/fields/:fieldName/available
import express from 'express';
import { requireDate, requireInteger, requirePeriod, requireSpotType } from '../../lib/validate.js';
import { getMonth, validatePeriod } from '../availability/availability.service.js';
import { sendConfirmation } from '../reservations/reservations.service.js';
import { getSettings } from '../settings/settings.service.js';
import {
  cancelReservation,
  createManualReservation,
  getDayLists,
  getDayStats,
  getNeedsMove,
  listFreeSpotsForStaff,
  listReservations,
  readReservationFilter,
} from './admin.service.js';
import { getSpotOverview, setAvailable, setUnavailable } from './spot-admin.service.js';

export function createAdminRouter({ db, config, clock, email, logger }) {
  const router = express.Router();

  // ---------- Daily overview ----------

  router.get('/day/:date', (req, res) => {
    const date = requireDate(req.params.date, 'De dag');
    res.json({ stats: getDayStats(db, date), ...getDayLists(db, date) });
  });

  router.get('/calendar', (req, res) => {
    const { year, month } = readMonth(req.query);
    const days = getMonth(db, { type: null, year, month, today: clock.today(), settings: getSettings(db), staffView: true });
    res.json({ year, month, days });
  });

  // ---------- Reservations ----------

  router.get('/reservations', (req, res) => {
    res.json({ reservations: listReservations(db, readReservationFilter(req.query)) });
  });

  router.post('/reservations', async (req, res) => {
    const reservation = createManualReservation(db, { input: req.body, today: clock.today(), settings: getSettings(db) });
    // Only a confirmation when there is an e-mail address (never to Bert or staff).
    if (reservation.email) {
      await sendConfirmation(db, { id: reservation.id, email, campsiteName: config.campsite.name, logger });
    }
    res.status(201).json({ reservation, emailSent: Boolean(reservation.email) });
  });

  router.post('/reservations/:id/cancel', (req, res) => {
    res.json({ reservation: cancelReservation(db, requireInteger(req.params.id, 'Het reserveringsnummer')) });
  });

  router.get('/needs-move', (req, res) => {
    res.json({ reservations: getNeedsMove(db) });
  });

  // ---------- Phone booking: calendar and free spots, reserve tents included ----------

  router.get('/availability', (req, res) => {
    const type = requireSpotType(req.query.type);
    const { year, month } = readMonth(req.query);
    const days = getMonth(db, { type, year, month, today: clock.today(), settings: getSettings(db), includeHeld: true });
    res.json({ type, year, month, days });
  });

  router.get('/availability/check', (req, res) => {
    const type = requireSpotType(req.query.type);
    const start = requireDate(req.query.start, 'De aankomstdatum');
    const end = requireDate(req.query.end, 'De vertrekdatum');
    res.json(validatePeriod(db, { type, start, end, today: clock.today(), settings: getSettings(db), includeHeld: true }));
  });

  router.get('/free-spots', (req, res) => {
    const type = requireSpotType(req.query.type);
    const { start, end } = requirePeriod(req.query);
    res.json({ spots: listFreeSpotsForStaff(db, { type, start, end }) });
  });

  // ---------- Spots out of use / back in use ----------

  router.get('/spots', (req, res) => {
    const day = req.query.day ? requireDate(req.query.day, 'De dag') : clock.today();
    res.json({ day, spots: getSpotOverview(db, day) });
  });

  router.post('/spots/:id/unavailable', (req, res) => {
    const spotId = requireInteger(req.params.id, 'Het nummer van de plek');
    res.json(setUnavailable(db, { spotId, reason: req.body?.reason, today: clock.today() }));
  });

  router.post('/spots/:id/available', (req, res) => {
    res.json(setAvailable(db, { spotId: requireInteger(req.params.id, 'Het nummer van de plek') }));
  });

  router.post('/fields/:fieldName/unavailable', (req, res) => {
    res.json(setUnavailable(db, { fieldName: req.params.fieldName, reason: req.body?.reason, today: clock.today() }));
  });

  router.post('/fields/:fieldName/available', (req, res) => {
    res.json(setAvailable(db, { fieldName: req.params.fieldName }));
  });

  return router;
}

function readMonth(query) {
  return {
    year: requireInteger(query.year, 'Het jaar', { min: 2000, max: 2100 }),
    month: requireInteger(query.month, 'De maand', { min: 1, max: 12 }),
  };
}
