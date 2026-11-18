// Staff accounts: create one, and check an e-mail address + password at sign-in
// (including the lockout after 5 wrong passwords). Used by the sign-in route and by
// the "create-staff" command.
import { HttpError } from '../../lib/errors.js';
import { DUMMY_HASH, MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from '../../lib/passwords.js';

export const ROLES = Object.freeze(['Staff', 'Admin']);
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a staff account. Throws an Error with a Dutch message when something is wrong
 * (the command shows it as is).
 */
export async function createStaffUser(db, { name, email, password, role }) {
  name = String(name ?? '').trim();
  email = String(email ?? '').trim();
  if (!name || name.length > 120) throw new Error('Vul een naam in van maximaal 120 tekens.');
  if (!EMAIL.test(email) || email.length > 190) throw new Error(`Het e-mailadres '${email}' klopt niet.`);
  if (!ROLES.includes(role)) throw new Error(`De rol moet ${ROLES.join(' of ')} zijn.`);
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Het wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens lang zijn.`);
  }
  if (findStaffByEmail(db, email)) throw new Error(`Er bestaat al een account met ${email}.`);

  const passwordHash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO staff_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, passwordHash, role);
  return { id: Number(lastInsertRowid), name, email, role };
}

export function findStaffByEmail(db, email) {
  return db.prepare('SELECT * FROM staff_users WHERE email = ?').get(String(email).trim());
}

/**
 * Checks the e-mail address and password. Returns the staff member, or throws:
 *   401 invalid_credentials: wrong address or password (we never say which of the two)
 *   429 locked_out:          too many wrong passwords; wait and try again
 */
export async function authenticate(db, { email, password, now }) {
  const user = findStaffByEmail(db, email);

  if (user?.locked_until && new Date(user.locked_until) > now) {
    throw lockedOut(user.locked_until, now);
  }

  const passwordOk = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  // Checking the password takes a moment, so read the account again: parallel attempts may
  // have changed it in the meantime. The counter is raised inside the database (+ 1), so
  // attempts sent at the same moment can never skip the lockout.
  const current = user && db.prepare('SELECT locked_until FROM staff_users WHERE id = ?').get(user.id);
  if (current?.locked_until && new Date(current.locked_until) > now) {
    throw lockedOut(current.locked_until, now);
  }

  if (!user || !passwordOk) {
    if (user) {
      const failures = db
        .prepare('UPDATE staff_users SET failed_login_count = failed_login_count + 1 WHERE id = ? RETURNING failed_login_count')
        .pluck()
        .get(user.id);
      if (failures >= MAX_FAILED_LOGINS) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString();
        db.prepare('UPDATE staff_users SET failed_login_count = 0, locked_until = ? WHERE id = ?').run(lockedUntil, user.id);
        throw lockedOut(lockedUntil, now);
      }
    }
    throw new HttpError(401, 'invalid_credentials', 'E-mailadres of wachtwoord klopt niet.');
  }

  db.prepare('UPDATE staff_users SET failed_login_count = 0, locked_until = NULL WHERE id = ?').run(user.id);
  return publicStaff(user);
}

/** The fields of a staff member that the frontend may see (never the password hash). */
export function publicStaff(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function lockedOut(lockedUntil, now) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil) - now) / 60_000));
  return new HttpError(
    429,
    'locked_out',
    `Er is te vaak een verkeerd wachtwoord ingevuld. Wacht ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'} en probeer het dan opnieuw.`,
  );
}
