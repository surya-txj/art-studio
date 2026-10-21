import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { AppContext } from './context.js';
import { loadUser } from './middleware/auth.js';
import { apiNotFound, errorHandler, requestLogger } from './middleware/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { paintingRoutes } from './modules/paintings/paintings.routes.js';
import { orderRoutes } from './modules/orders/orders.routes.js';
import { bookingRoutes } from './modules/bookings/bookings.routes.js';
import { potteryOptionRoutes, potteryRequestRoutes } from './modules/pottery/pottery.routes.js';
import { studioRoutes } from './modules/studio/studio.routes.js';

/** Builds the Express app. Kept separate from index.ts so tests can create one per test. */
export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(loadUser(ctx));

  app.get('/api/health', (_req, res) => {
    ctx.db.prepare('SELECT 1').get(); // proves the database is reachable
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/paintings', paintingRoutes(ctx));
  app.use('/api/orders', orderRoutes(ctx));
  app.use('/api/bookings', bookingRoutes(ctx));
  app.use('/api/pottery-options', potteryOptionRoutes(ctx));
  app.use('/api/pottery-requests', potteryRequestRoutes(ctx));
  app.use('/api/studio', studioRoutes(ctx));
  app.use('/api', apiNotFound);

  app.use('/images', express.static(ctx.config.imagesDir, { maxAge: '1h' }));

  // In production the built React app is served by this same server, so the
  // browser talks to one origin and the session cookie just works (no CORS).
  const indexHtml = path.join(ctx.config.clientDistDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(ctx.config.clientDistDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
