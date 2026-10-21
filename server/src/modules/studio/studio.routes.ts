import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { addDays, todayIn } from '../../lib/dates.js';
import { BOOKING_RULES } from '../bookings/bookings.service.js';
import { POTTERY_RULES } from '../pottery/pottery.service.js';
import { getCurrency, getMuralRate } from './settings.service.js';

/**
 * Public, read-only facts the UI needs to build its forms: rate, currency and
 * today's allowed date ranges. The server still re-checks everything on submit.
 */
export function studioRoutes(ctx: AppContext) {
  const router = Router();

  router.get('/info', (_req, res) => {
    const today = todayIn(ctx.config.studioTimezone, ctx.clock());
    res.json({
      currency: getCurrency(ctx),
      muralRatePerSqFt: getMuralRate(ctx),
      today,
      booking: {
        ...BOOKING_RULES,
        earliestDate: addDays(today, BOOKING_RULES.minDaysAhead),
        latestDate: addDays(today, BOOKING_RULES.maxDaysAhead),
      },
      pottery: {
        ...POTTERY_RULES,
        earliestNeededBy: addDays(today, POTTERY_RULES.minDaysAhead),
      },
    });
  });

  return router;
}
