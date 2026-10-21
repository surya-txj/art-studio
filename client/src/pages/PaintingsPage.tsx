import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Painting } from '../api/types';
import { AsyncView, StatusBadge } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { formatMoney } from '../lib/format';
import { useAuth } from '../auth/AuthContext';

type Filter = 'all' | 'available' | 'sold';

export function PaintingsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const paintings = useAsync(
    () => api<{ paintings: Painting[] }>(filter === 'all' ? '/paintings' : `/paintings?status=${filter}`),
    [filter],
  );

  return (
    <section>
      <div className="page-head">
        <h1>Paintings</h1>
        <div className="row">
          <label>
            Show{' '}
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
            </select>
          </label>
          {user?.role === 'studio' && (
            <Link className="button" to="/studio/paintings/new">
              Add painting
            </Link>
          )}
        </div>
      </div>

      <AsyncView
        {...paintings}
        onRetry={paintings.reload}
        isEmpty={(d) => d.paintings.length === 0}
        empty="No paintings match this filter."
      >
        {(d) => (
          <ul className="grid">
            {d.paintings.map((p) => (
              <li key={p.id} className="card">
                <Link to={`/paintings/${p.id}`} className="card-link">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="img-placeholder">No image</div>
                  )}
                  <h2 className="card-title">{p.title}</h2>
                </Link>
                <p className="muted">{p.artist}</p>
                <div className="row spread">
                  <strong>{formatMoney(p.price)}</strong>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </section>
  );
}
