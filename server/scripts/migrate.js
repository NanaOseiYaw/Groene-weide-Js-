// npm run db:migrate — bring the database up to date without starting the server.
import { loadConfig, loadEnvFile } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';

loadEnvFile();
const config = loadConfig();
const db = openDatabase(config.databasePath);
try {
  const applied = migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'The database is up to date.');
} finally {
  db.close();
}
