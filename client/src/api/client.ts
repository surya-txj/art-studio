/** An error response from the API, carrying the server's code and message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Small fetch wrapper. Every non-2xx response is thrown as an ApiError whose
 * message is the server's human-readable message, so pages can show it as-is.
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check that it is running and try again.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error;
    // No JSON error from our API means something in between failed (e.g. the dev proxy
    // answers 502 when the API server is not running).
    if (!error && res.status >= 502 && res.status <= 504) {
      throw new ApiError(res.status, 'SERVER_UNAVAILABLE', 'The server is not responding. Please try again shortly.');
    }
    throw new ApiError(res.status, error?.code ?? 'UNKNOWN', error?.message ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong. Please try again.';
