import type { AppContext } from '../../context.js';

function getSetting(ctx: AppContext, key: string): string {
  const row = ctx.db.prepare('SELECT value FROM studio_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  // Settings come from seed.json on startup; a missing one means the seed did not run.
  if (!row) throw new Error(`Missing studio setting "${key}". Run the seed script.`);
  return row.value;
}

/** Wall-painting rate per square foot, from seed.json's mural.ratePerSqFt. */
export const getMuralRate = (ctx: AppContext) => Number(getSetting(ctx, 'mural_rate_per_sqft'));
export const getCurrency = (ctx: AppContext) => getSetting(ctx, 'currency');
