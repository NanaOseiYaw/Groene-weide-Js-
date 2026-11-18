// Builds the Express application: middleware, routes and error handling.
// It does not start listening; server.js does that.
//
// Everything the routes depend on (database, clock, payment, e-mail) is passed in here.
// The real app uses the defaults; tests pass their own (an in-memory database, a fixed
// "today", a payment that fails on purpose, an e-mail sender that keeps mails in memory).
import express from 'express';
import { todayIn } from './lib/dates.js';
import { createLogEmailSender } from './lib/email.js';
import { errorHandler, notFound } from './lib/errors.js';
import { createFakePaymentService } from './lib/payment.js';
import { securityHeaders } from './lib/security-headers.js';
import { createAvailabilityRouter } from './modules/availability/availability.routes.js';
import { createReservationsRouter } from './modules/reservations/reservations.routes.js';
import { createCampsiteRouter } from './modules/settings/settings.routes.js';
import { createSpotsRouter } from './modules/spots/spots.routes.js';

/**
 * @param {object} options
 * @param {import('better-sqlite3').Database} options.db  open database connection
 * @param {object} options.config  result of loadConfig()
 * @param {Console} [options.logger]
 * @param {{ today: () => string }} [options.clock]  what "today" is ('YYYY-MM-DD')
 * @param {{ pay: Function }} [options.payment]
 * @param {{ send: Function }} [options.email]
 */
export function createApp({
  db,
  config,
  logger = console,
  clock = { today: () => todayIn(config.timeZone) },
  payment = createFakePaymentService({ delayMs: config.paymentDelayMs }),
  email = createLogEmailSender({ folder: config.mailFolder, logger }),
}) {
  const deps = { db, config, logger, clock, payment, email };

  const app = express();
  app.disable('x-powered-by'); // do not advertise which framework we use

  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));

  // All JSON endpoints live under /api.
  const api = express.Router();

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

  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler({ logger }));
  return app;
}
