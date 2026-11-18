// Password hashing with scrypt, built into Node.js (no extra package).
// scrypt is deliberately slow and memory-hungry, so guessing passwords from a stolen
// database takes a very long time. Every password gets its own random salt.
//
// Stored format: scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
// The parameters are stored with the hash, so they can be raised later without
// breaking existing accounts.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

/** true when the password belongs to the stored hash. Takes the same time whether it is right or wrong. */
export async function verifyPassword(password, stored) {
  const [algorithm, N, r, p, salt, expected] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const expectedBytes = Buffer.from(expected, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expectedBytes.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expectedBytes);
}

/**
 * A valid hash of a random password. Used when someone signs in with an e-mail address that
 * does not exist: we still check a password, so the response time does not reveal which
 * addresses have an account.
 */
export const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString('hex'));
