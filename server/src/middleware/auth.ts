import type { RequestHandler } from 'express';
import type { AppContext, Role } from '../context.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findUserBySession } from '../modules/auth/auth.service.js';

export const SESSION_COOKIE = 'sid';

/** Runs on every request: if the session cookie is valid, sets req.user. Never rejects. */
export function loadUser(ctx: AppContext): RequestHandler {
  return (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      req.user = findUserBySession(ctx, token);
    }
    next();
  };
}

/** 401 if nobody is logged in. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

/** 401 if nobody is logged in, 403 if the logged-in user has the wrong role. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
