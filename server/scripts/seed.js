// npm run db:seed — add the dummy data to an empty database (development only).
import { loadConfig, loadEnvFile } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

loadEnvFile();
const config = loadConfig();
if (config.isProduction) {
  console.error('Refusing to add dummy data: NODE_ENV is production.');
  process.exit(1);
}

const db = openDatabase(config.databasePath);
try {
  migrate(db);
  const { seeded } = seedDatabase(db);
  console.log(seeded ? 'Dummy data added.' : 'There are already spots in the database; nothing added.');
} finally {
  db.close();
}
