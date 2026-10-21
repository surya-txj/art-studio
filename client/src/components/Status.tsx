import type { ReactNode } from 'react';

// Shared building blocks for the loading / empty / error / success states.

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="state state-loading" role="status">
      {label}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="state state-empty">{children}</p>;
}

export function Success({ children }: { children: ReactNode }) {
  return (
    <p className="state state-success" role="status">
      {children}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

/**
 * Renders the right state for data loaded with useAsync. Calls `children`
 * only when there is data and it is not empty.
 */
export function AsyncView<T>({
  loading,
  error,
  data,
  onRetry,
  isEmpty,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | undefined;
  onRetry: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (error) return <ErrorBox message={error} onRetry={onRetry} />;
  if (data === undefined) return loading ? <Loading /> : null;
  if (isEmpty?.(data)) return <Empty>{empty ?? 'Nothing here yet.'}</Empty>;
  return <>{children(data)}</>;
}
