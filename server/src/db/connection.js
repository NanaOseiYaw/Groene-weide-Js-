// Opens the SQLite database with the settings this application relies on.
//
// better-sqlite3 is synchronous: a query runs to completion before the next line of
// JavaScript runs. That makes transactions simple and safe in one Node process, which is
// exactly what the "no double bookings" rule needs (see docs/migration-plan.md, §8.1).
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/** @returns {import('better-sqlite3').Database} */
export function openDatabase(filePath) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);

  // WAL: readers (calendar, lists) do not block the one writer (a booking), and vice versa.
  db.pragma('journal_mode = WAL');
  // SQLite ignores foreign keys unless this is switched on, for every connection.
  db.pragma('foreign_keys = ON');
  // If another process holds the write lock (e.g. "npm run create-staff"), wait up to 5 s instead of failing.
  db.pragma('busy_timeout = 5000');

  return db;
}
