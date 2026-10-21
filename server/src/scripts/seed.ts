import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { readSeedFile, seedDatabase } from '../db/seed.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);
const result = seedDatabase(db, readSeedFile(config.seedFile), {
  bcryptRounds: config.bcryptRounds,
  studioPassword: process.env.STUDIO_PASSWORD,
});
db.close();

console.log(`Seeded ${config.databaseFile}`);
console.log(`  new paintings inserted: ${result.paintingsInserted}`);
console.log(`  studio account: ${result.studioCreated ? 'created' : 'already existed'}`);
