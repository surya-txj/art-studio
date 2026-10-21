import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { readSeedFile, seedDatabase } from './db/seed.js';
import { systemClock } from './lib/dates.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);

// Seeding is idempotent, so running it on every start means a fresh clone works
// with no extra step, and an existing database is left as it is.
seedDatabase(db, readSeedFile(config.seedFile), {
  bcryptRounds: config.bcryptRounds,
  studioPassword: process.env.STUDIO_PASSWORD,
});

const app = createApp({ db, clock: systemClock, config });
app.listen(config.port, () => {
  console.log(`Art Studio API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databaseFile}`);
});
