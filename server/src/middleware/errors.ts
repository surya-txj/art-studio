import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

/** Unknown /api routes get the same JSON error shape as everything else. */
export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}` } });
};

/** The single place where errors become HTTP responses. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // express.json() throws this when the body is not valid JSON.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON.' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }

  // Unexpected: log the details on the server, send the client a generic message.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};

/** One line per request: method, path, status, duration. Bodies are never logged. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
};
