/**
 * An error we throw on purpose. The error handler turns it into
 *   { "error": { "code": "...", "message": "...", "details"?: ... } }
 * with the given HTTP status. Anything that is NOT an AppError becomes a 500
 * with a generic message, so internal details never leak to the client.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Please log in to continue.') =>
  new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
