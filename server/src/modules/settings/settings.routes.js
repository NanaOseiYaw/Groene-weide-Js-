// GET /api/campsite: the public campsite details the frontend needs on every page.
import express from 'express';
import { getSettings } from './settings.service.js';

export function createCampsiteRouter({ db, config, clock }) {
  const router = express.Router();

  router.get('/campsite', (req, res) => {
    const settings = getSettings(db);
    const today = clock.today();
    const { name, phone, email } = config.campsite;
    res.json({
      name,
      phone,
      // Digits and + only, for a tel: link.
      phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '',
      email,
      season: { start: settings.seasonStart, end: settings.seasonEnd, text: settings.seasonText },
      // The server decides what "today" is (time zone from the settings), not the visitor's computer.
      today,
      firstOpenDay: settings.nextOpenDay(today),
    });
  });

  return router;
}
