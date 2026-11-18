// Builds the Express application: middleware, routes and error handling.
// It does not start listening; server.js does that.
//
// Everything the routes depend on (database, clock, payment, e-mail, AI service) is passed in here.
// The real app uses the defaults; tests pass their own (an in-memory database, a fixed
// "today", a payment that fails on purpose, an e-mail sender that keeps mails in memory).
import express from 'express';
import { todayIn } from '@groene-weide/shared/dates';
import { createAiClient } from './ai/ai-client.js';
import { serveClientApp } from './lib/client-app.js';
import { createLogEmailSender } from './lib/email.js';
import { errorHandler, notFound } from './lib/errors.js';
import { createFakePaymentService } from './lib/payment.js';
import { securityHeaders } from './lib/security-headers.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createAiRouter } from './modules/ai/ai.routes.js';
import { checkOrigin, loadSession, requireStaff } from './modules/auth/auth.middleware.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAvailabilityRouter } from './modules/availability/availability.routes.js';
import { createPhotosRouter } from './modules/photos/photos.routes.js';
import { createReservationsRouter } from './modules/reservations/reservations.routes.js';
import { createCampsiteRouter } from './modules/settings/settings.routes.js';
import { createSpotsRouter } from './modules/spots/spots.routes.js';

/**
 * @param {object} options
 * @param {import('better-sqlite3').Database} options.db  open database connection
 * @param {object} options.config  result of loadConfig()
 * @param {Console} [options.logger]
 * @param {{ today: () => string, now: () => Date }} [options.clock]  what "today" ('YYYY-MM-DD') and "now" are
 * @param {{ pay: Function }} [options.payment]
 * @param {{ send: Function }} [options.email]
 * @param {ReturnType<typeof createAiClient>} [options.ai]  the Python AI service (docs/ai-contract.md)
 */
export function createApp({
  db,
  config,
  logger = console,
  clock = { today: () => todayIn(config.timeZone), now: () => new Date() },
  payment = createFakePaymentService({ delayMs: config.paymentDelayMs }),
  email = createLogEmailSender({ folder: config.mailFolder, logger }),
  ai = createAiClient(config.ai, { logger }),
}) {
  const deps = { db, config, logger, clock, payment, email, ai };

  const app = express();
  app.disable('x-powered-by'); // do not advertise which framework we use
  if (config.isProduction) app.set('trust proxy', 1); // behind the hosting's HTTPS proxy: trust its headers

  app.use(securityHeaders);

  // Uploaded spot photos are public (guests see them in the spot pop-up).
  app.use('/uploads/spots', express.static(config.spotPhotosFolder, { index: false, dotfiles: 'deny', fallthrough: true, maxAge: '7d' }));

  // All JSON endpoints live under /api.
  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(checkOrigin(deps));
  api.use(loadSession(deps));

  // Health check for hosting and monitoring: is the server up and can it read the database?
  api.get('/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', environment: config.nodeEnv });
    } catch (error) {
      logger.error('Health check: database not reachable', error);
      res.status(503).json({ status: 'error' });
    }
  });

  // Public endpoints for the guest booking flow.
  api.use(createCampsiteRouter(deps));
  api.use(createSpotsRouter(deps));
  api.use(createAvailabilityRouter(deps));
  api.use(createReservationsRouter(deps));

  // Sign-in, and everything behind it. requireStaff runs before any staff route.
  api.use(createAuthRouter(deps));
  api.use('/admin', requireStaff, createAdminRouter(deps), createPhotosRouter(deps), createAiRouter(deps));

  app.use('/api', api);

  // The built Vue frontend (production). Development uses the Vite dev server instead.
  serveClientApp(app, config.clientFolder);

  app.use(notFound);
  app.use(errorHandler({ logger }));
  return app;
}
