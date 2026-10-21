import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return value;
}

export interface Config {
  isProduction: boolean;
  port: number;
  databaseFile: string;
  sessionTtlHours: number;
  bcryptRounds: number;
  studioTimezone: string;
  seedFile: string;
  imagesDir: string;
  clientDistDir: string;
}

export function loadConfig(): Config {
  return {
    isProduction: process.env.NODE_ENV === 'production',
    port: intFromEnv('PORT', 4000),
    databaseFile: path.resolve(serverRoot, process.env.DATABASE_FILE || 'data/art-studio.db'),
    sessionTtlHours: intFromEnv('SESSION_TTL_HOURS', 24 * 7),
    bcryptRounds: intFromEnv('BCRYPT_ROUNDS', 10),
    // All "days away" rules are measured in the studio's local calendar.
    studioTimezone: process.env.STUDIO_TIMEZONE || 'Asia/Kolkata',
    seedFile: path.join(serverRoot, 'seed-data/seed.json'),
    imagesDir: path.join(serverRoot, 'seed-data/images'),
    clientDistDir: path.resolve(serverRoot, '../client/dist'),
  };
}
