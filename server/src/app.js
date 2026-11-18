// Builds the Express application: middleware, routes and error handling.
// It does not start listening; server.js does that. Tests create their own app
// with an in-memory database, which is why the database is passed in.
import express from 'express';
import { errorHandler, notFound } from './lib/errors.js';
import { securityHeaders } from './lib/security-headers.js';

/**
 * @param {object} options
 * @param {import('better-sqlite3').Database} options.db  open database connection
 * @param {object} options.config  result of loadConfig()
 * @param {Console} [options.logger]
 */
export function createApp({ db, config, logger = console }) {
  const app = express();
  app.disable('x-powered-by'); // do not advertise which framework we use

  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));

  // All JSON endpoints live under /api. Feature modules add their routers here in later phases.
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

  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler({ logger }));
  return app;
}
