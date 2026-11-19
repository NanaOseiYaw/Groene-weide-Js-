// A small migration runner: the JavaScript replacement for EF Core migrations.
//
// How it works:
// - Every change to the database structure is a new file in ./migrations,
//   named with a number first: 001_initial.sql, 002_auth.sql, ...
// - The table schema_migrations remembers which files have already run.
// - On start-up every file that has not run yet is executed, in order, each in its own transaction.
//   If a file fails, nothing of that file is applied and the error is shown.
//
// Rules for the team: never change a migration file that is already committed.
// Write a new file instead. Do not put BEGIN/COMMIT in a file; the runner does that.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsFolder = fileURLToPath(new URL('./migrations/', import.meta.url));
const FILE_NAME = /^\d{3}_[a-z0-9_-]+\.sql$/;

/**
 * Runs all migrations that have not run yet.
 * @returns {string[]} the file names that were applied now (empty when up to date)
 */
export function migrate(db, folder = migrationsFolder) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT`);

  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').pluck().all());
  const pending = fs.readdirSync(folder).filter((file) => FILE_NAME.test(file) && !applied.has(file)).sort();

  const recordVersion = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(folder, file), 'utf8');
    try {
      db.transaction(() => {
        db.exec(sql);
        recordVersion.run(file, new Date().toISOString());
      })();
    } catch (error) {
      error.message = `Migration ${file} failed: ${error.message}`;
      throw error;
    }
  }
  return pending;
}
