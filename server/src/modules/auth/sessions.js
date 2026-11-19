// Sign-in sessions, stored in the "sessions" table.
//
// After a correct password the browser gets a random token in a cookie. That cookie is:
//   HttpOnly   JavaScript in the page cannot read it (protects against XSS stealing it)
//   SameSite   Lax: not sent with forms or requests from other websites (protects against CSRF)
//   Secure     only over HTTPS (in production)
// A session lasts 30 days and is extended while it is used ("sliding"), like the C# version.
// Without "Onthoud mij" the cookie has no expiry date, so the browser forgets it when it closes.
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'gw_session';
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createSession(db, { staffUserId, persistent, now }) {
  // Clean up expired sessions now and then (here: at every sign-in).
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  db.prepare('INSERT INTO sessions (token_hash, staff_user_id, persistent, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), staffUserId, persistent ? 1 : 0, expiresAt.toISOString());
  return { token, expiresAt, persistent };
}

/**
 * Finds the staff member for a session token, or null when the token is unknown or expired.
 * Extends the session when less than half of its lifetime is left.
 */
export function findSession(db, { token, now }) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT s.persistent, s.expires_at, u.id, u.name, u.email, u.role
      FROM sessions s JOIN staff_users u ON u.id = s.staff_user_id
     WHERE s.token_hash = ?`).get(tokenHash);
  if (!row) return null;

  let expiresAt = new Date(row.expires_at);
  if (expiresAt <= now) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  let renewed = false;
  if (expiresAt - now < (SESSION_DAYS * DAY_MS) / 2) {
    expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(expiresAt.toISOString(), tokenHash);
    renewed = true;
  }
  return {
    staff: { id: row.id, name: row.name, email: row.email, role: row.role },
    session: { token, expiresAt, persistent: row.persistent === 1, renewed },
  };
}

export function deleteSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/** Puts the session token in the cookie. */
export function setSessionCookie(res, session, { secure }) {
  res.cookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    // Only "Onthoud mij" gets an expiry date; otherwise it is a browser-session cookie.
    ...(session.persistent ? { expires: session.expiresAt } : {}),
  });
}

export function clearSessionCookie(res, { secure }) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}

/** Reads one cookie from the Cookie header (no extra package needed for this). */
export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
