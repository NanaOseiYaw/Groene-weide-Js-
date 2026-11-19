// Entry point: read the settings, open and update the database, start the HTTP server.
import { createApp } from './app.js';
import { ConfigError, loadConfig, loadEnvFile } from './config.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

let config;
try {
  loadEnvFile();
  config = loadConfig();
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

const db = openDatabase(config.databasePath);

// Bring the database up to date on every start, like "dotnet ef database update" in the C# version.
for (const file of migrate(db)) console.log(`Database: applied migration ${file}`);

if (config.seedOnStart && seedDatabase(db).seeded) {
  console.log('Database: added dummy data (60 spots, test reservations in 2027).');
}

const app = createApp({ db, config });
const server = app.listen(config.port, (error) => {
  // Express 5 also calls this function when starting fails; the 'error' handler below explains why.
  if (error) return;
  console.log(`Groene Weide API (${config.nodeEnv}) on http://localhost:${server.address().port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other program or set PORT in .env.`);
  } else {
    console.error(error);
  }
  db.close();
  process.exit(1);
});

// Stop cleanly (Ctrl+C or the hosting platform): finish open requests, then close the database.
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
