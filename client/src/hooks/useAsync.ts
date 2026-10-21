import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Runs an async loader and tracks loading / error / data, so every page shows
 * the three states the same way. `reload()` re-fetches after an action while
 * keeping the current data on screen. `deps` works like useEffect's list.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
    // The caller controls when the loader changes, like a useEffect dependency list.
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, reload: run };
}
