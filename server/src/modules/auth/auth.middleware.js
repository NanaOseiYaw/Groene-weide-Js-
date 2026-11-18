// Middleware for signed-in staff.
//
//   loadSession   on every /api request: who is signed in? Sets req.staff (or leaves it undefined).
//   requireStaff  in front of every /api/admin route: 401 when nobody is signed in.
//   checkOrigin   on every request that changes something: refuses requests started by another website.
import { HttpError } from '../../lib/errors.js';
import { ROLES } from './staff-users.service.js';
import { SESSION_COOKIE, findSession, readCookie, setSessionCookie } from './sessions.js';

export function loadSession({ db, config, clock }) {
  return (req, res, next) => {
    const found = findSession(db, { token: readCookie(req, SESSION_COOKIE), now: clock.now() });
    if (found) {
      req.staff = found.staff;
      req.sessionToken = found.session.token;
      // A persistent cookie gets the new expiry date too.
      if (found.session.renewed && found.session.persistent) {
        setSessionCookie(res, found.session, { secure: config.isProduction });
      }
    }
    next();
  };
}

/** Only staff (role Staff or Admin) may continue. Checked on the server, not just hidden in the menu. */
export function requireStaff(req, res, next) {
  if (!req.staff || !ROLES.includes(req.staff.role)) {
    return next(new HttpError(401, 'not_signed_in', 'Log in om deze pagina te bekijken.'));
  }
  // Staff data must never end up in a shared or browser cache.
  res.set('Cache-Control', 'no-store');
  next();
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Extra protection against cross-site request forgery (CSRF), on top of the SameSite cookie.
 * Browsers send an Origin header with every POST/PATCH/DELETE. It must be this site itself,
 * or one of ALLOWED_ORIGINS (e.g. the Vite dev server). Requests without an Origin header
 * do not come from a browser page (e.g. a test or a command-line tool) and carry no cookie
 * from another site, so they are allowed.
 */
export function checkOrigin({ config }) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (SAFE_METHODS.includes(req.method) || !origin) return next();

    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost && (originHost === req.get('host') || config.allowedOrigins.includes(origin))) return next();
    next(new HttpError(403, 'forbidden_origin', 'Dit verzoek komt niet van deze website en is geweigerd.'));
  };
}
