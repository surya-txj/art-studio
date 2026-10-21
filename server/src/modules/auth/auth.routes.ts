import { Router, type CookieOptions } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { SESSION_COOKIE, requireAuth } from '../../middleware/auth.js';
import { parse } from '../../lib/validate.js';
import { createSession, deleteSession, registerCustomer, verifyCredentials } from './auth.service.js';

// z.strictObject rejects unknown keys, so a client cannot sneak in "role": "studio".
const registerSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export function authRoutes(ctx: AppContext) {
  const router = Router();

  const cookieOptions = (expires: Date): CookieOptions => ({
    httpOnly: true, // not readable from JavaScript, which blunts XSS token theft
    sameSite: 'lax', // not sent on cross-site POSTs, which blunts CSRF
    secure: ctx.config.isProduction, // HTTPS-only in production
    expires,
    path: '/',
  });

  router.post('/register', (req, res) => {
    const input = parse(registerSchema, req.body);
    const user = registerCustomer(ctx, input);
    const session = createSession(ctx, user.id);
    res.cookie(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
    res.status(201).json({ user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = verifyCredentials(ctx, email, password);
    const session = createSession(ctx, user.id);
    res.cookie(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
    res.json({ user });
  });

  router.post('/logout', (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') deleteSession(ctx, token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
