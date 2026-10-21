import { z } from 'zod';
import { badRequest } from './errors.js';
import { isValidDateString } from './dates.js';

/** Parses input with a Zod schema, or throws a 400 listing every invalid field. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      message: issue.message,
    }));
    const summary = fields.map((f) => (f.field === '(body)' ? f.message : `${f.field}: ${f.message}`));
    throw badRequest(summary.join('; '), fields);
  }
  return result.data;
}

/** URL ids like /orders/:id must be positive integers. */
export const idParam = z.coerce.number().int().positive();

export const dateString = z
  .string({ error: 'Date is required' })
  .refine(isValidDateString, 'Must be a valid date in YYYY-MM-DD format');
