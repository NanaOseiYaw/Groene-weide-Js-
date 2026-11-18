// Sign-in endpoints for staff.
//   POST /api/auth/login   { email, password, rememberMe } → sets the session cookie
//   POST /api/auth/logout  → removes the session and the cookie
//   GET  /api/auth/me      → who is signed in (401 when nobody)
import express from 'express';
import { HttpError } from '../../lib/errors.js';
import { text } from '../../lib/validate.js';
import { requireStaff } from './auth.middleware.js';
import { clearSessionCookie, createSession, deleteSession, setSessionCookie } from './sessions.js';
import { authenticate } from './staff-users.service.js';

export function createAuthRouter({ db, config, clock }) {
  const router = express.Router();
  const cookieOptions = { secure: config.isProduction };

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/auth/login', async (req, res) => {
    const email = text(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const fields = {};
    if (!email) fields.email = 'Vul je e-mailadres in.';
    if (!password) fields.password = 'Vul je wachtwoord in.';
    if (Object.keys(fields).length > 0) {
      throw new HttpError(422, 'validation_failed', 'Vul je e-mailadres en wachtwoord in.', fields);
    }

    const now = clock.now();
    const staff = await authenticate(db, { email, password, now });

    // A fresh session at every sign-in; an old one from this browser is removed (no session fixation).
    deleteSession(db, req.sessionToken);
    const session = createSession(db, { staffUserId: staff.id, persistent: req.body?.rememberMe === true, now });
    setSessionCookie(res, session, cookieOptions);
    res.json({ staff });
  });

  router.post('/auth/logout', (req, res) => {
    deleteSession(db, req.sessionToken);
    clearSessionCookie(res, cookieOptions);
    res.status(204).end();
  });

  router.get('/auth/me', requireStaff, (req, res) => {
    res.json({ staff: req.staff });
  });

  return router;
}
