// Staff endpoints that use the AI service (mounted under /api/admin, behind requireStaff).
//   GET /api/admin/ai/status                         { configured, available }
//   GET /api/admin/ai/occupancy-forecast?from&to     expected occupancy per day and type
// When the AI service is off, slow or wrong, the client throws AiUnavailableError and the
// error handler answers 503 ai_unavailable. Nothing else in the API depends on these routes.
import express from 'express';
import { addDays } from '@groene-weide/shared/dates';
import { badRequest, requireDate } from '../../lib/validate.js';
import { getSettings } from '../settings/settings.service.js';
import { MAX_FORECAST_DAYS } from '../../ai/ai-contract.js';
import { buildOccupancyHistory } from './ai.service.js';

export function createAiRouter({ db, ai }) {
  const router = express.Router();

  router.get('/ai/status', async (req, res) => {
    res.json({ configured: ai.configured, available: await ai.isAvailable() });
  });

  router.get('/ai/occupancy-forecast', async (req, res) => {
    const from = requireDate(req.query.from, 'De eerste dag');
    const to = requireDate(req.query.to, 'De laatste dag');
    if (to < from) throw badRequest('De laatste dag moet op of na de eerste dag liggen.');
    if (addDays(from, MAX_FORECAST_DAYS - 1) < to) throw badRequest(`Kies een periode van hoogstens ${MAX_FORECAST_DAYS} dagen.`);

    const history = buildOccupancyHistory(db, { from, settings: getSettings(db) });
    const forecast = await ai.occupancyForecast({ from, to, history });
    res.json({ from, to, forecast });
  });

  return router;
}
