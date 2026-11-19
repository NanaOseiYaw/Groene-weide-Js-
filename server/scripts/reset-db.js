// npm run db:reset — delete the local database and start again with fresh dummy data.
// Stop the server first. Development only: this throws away every reservation in the file.
import fs from 'node:fs';
import { loadConfig, loadEnvFile } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

loadEnvFile();
const config = loadConfig();
if (config.isProduction) {
  console.error('Refusing to reset the database: NODE_ENV is production.');
  process.exit(1);
}
if (config.databasePath === ':memory:') {
  console.error('DATABASE_PATH is :memory:, there is no file to reset.');
  process.exit(1);
}

// The SQLite file plus its write-ahead log files.
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(config.databasePath + suffix, { force: true });
}

const db = openDatabase(config.databasePath);
try {
  migrate(db);
  seedDatabase(db);
  console.log(`New database with dummy data: ${config.databasePath}`);
} finally {
  db.close();
}
