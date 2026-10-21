import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { schemaSql } from './schema.js';

export type DB = Database.Database;

/** Opens (or creates) the SQLite database and makes sure all tables exist. */
export function openDatabase(file: string): DB {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  // SQLite does not enforce foreign keys unless asked to.
  db.pragma('foreign_keys = ON');
  // WAL lets readers work while one writer writes; busy_timeout makes a second
  // writer wait for the lock instead of failing immediately.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(schemaSql);
  return db;
}

/** True when an error is SQLite rejecting a row because of a UNIQUE index. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Database.SqliteError &&
    (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
  );
}
