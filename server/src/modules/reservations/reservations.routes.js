// Guest booking endpoints (booking step 6).
//   POST /api/reservations              store the reservation (payment still open) → 201 + bookingToken
//   POST /api/reservations/:id/payment  pay with the bookingToken → paid + confirmation e-mail
import express from 'express';
import { requireInteger } from '../../lib/validate.js';
import { getSettings } from '../settings/settings.service.js';
import { createGuestReservation, payReservation } from './reservations.service.js';

export function createReservationsRouter({ db, config, clock, payment, email, logger }) {
  const router = express.Router();
  const paymentsInProgress = new Set();

  router.post('/reservations', (req, res) => {
    const result = createGuestReservation(db, { input: req.body, today: clock.today(), settings: getSettings(db) });
    res.status(201).json(result);
  });

  router.post('/reservations/:id/payment', async (req, res) => {
    const id = requireInteger(req.params.id, 'Het reserveringsnummer');
    const reservation = await payReservation(db, {
      id,
      bookingToken: req.body?.bookingToken,
      payment,
      email,
      campsiteName: config.campsite.name,
      logger,
      paymentsInProgress,
    });
    res.json({ reservation });
  });

  return router;
}
