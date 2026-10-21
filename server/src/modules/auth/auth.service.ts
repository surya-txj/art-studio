import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AppContext, AuthUser } from '../../context.js';
import { isUniqueViolation } from '../../db/database.js';
import { AppError, conflict } from '../../lib/errors.js';

interface UserRow extends AuthUser {
  password_hash: string;
}

// Sessions: the browser gets a random 32-byte token in an httpOnly cookie.
// The database stores only a SHA-256 hash of it, so a leaked database cannot
// be used to log in as anyone.
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function registerCustomer(
  ctx: AppContext,
  input: { name: string; email: string; password: string },
): AuthUser {
  const passwordHash = bcrypt.hashSync(input.password, ctx.config.bcryptRounds);
  try {
    // The role is hard-coded: public sign-up can only ever create customers.
    const result = ctx.db
      .prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'customer')`)
      .run(input.email, input.name, passwordHash);
    return { id: Number(result.lastInsertRowid), email: input.email, name: input.name, role: 'customer' };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
}

export function verifyCredentials(ctx: AppContext, email: string, password: string): AuthUser {
  const row = ctx.db
    .prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;
  // Same message whether the email or the password is wrong, so the response
  // does not reveal which emails have accounts.
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function createSession(ctx: AppContext, userId: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(ctx.clock().getTime() + ctx.config.sessionTtlHours * 3_600_000);
  ctx.db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function findUserBySession(ctx: AppContext, token: string): AuthUser | undefined {
  return ctx.db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), ctx.clock().toISOString()) as AuthUser | undefined;
}

export function deleteSession(ctx: AppContext, token: string) {
  ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}
