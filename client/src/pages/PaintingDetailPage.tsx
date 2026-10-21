import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Order, Painting } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { FeedbackMessage } from '../components/Layout';
import { AsyncView, StatusBadge } from '../components/Status';
import { useAction } from '../hooks/useAction';
import { useAsync } from '../hooks/useAsync';
import { formatMoney } from '../lib/format';

export function PaintingDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const painting = useAsync(() => api<{ painting: Painting }>(`/paintings/${encodeURIComponent(id)}`), [id]);
  const action = useAction();

  async function buy(p: Painting) {
    if (!window.confirm(`Buy "${p.title}" for ${formatMoney(p.price)}?`)) return;
    await action.run(
      'buy',
      () => api<{ order: Order }>('/orders', { method: 'POST', body: { paintingId: p.id } }),
      'Order placed! You can see it under My account.',
    );
    // Whether it worked or someone else just bought it, refresh to show the real status.
    painting.reload();
  }

  return (
    <section>
      <p>
        <Link to="/">← All paintings</Link>
      </p>
      <AsyncView {...painting} onRetry={painting.reload}>
        {({ painting: p }) => (
          <article className="detail">
            {p.imageUrl ? <img src={p.imageUrl} alt={p.title} /> : <div className="img-placeholder">No image</div>}
            <div>
              <h1>{p.title}</h1>
              <p className="muted">by {p.artist}</p>
              <p>{p.description}</p>
              <p className="price">
                {formatMoney(p.price)} <StatusBadge status={p.status} />
              </p>

              <FeedbackMessage feedback={action.feedback} />

              {!user && p.status === 'available' && (
                <p>
                  <Link to="/login" state={{ from: `/paintings/${p.id}` }}>
                    Log in
                  </Link>{' '}
                  as a customer to buy this painting.
                </p>
              )}
              {user?.role === 'customer' && p.status === 'available' && (
                <button type="button" onClick={() => buy(p)} disabled={action.pending === 'buy'}>
                  {action.pending === 'buy' ? 'Placing order…' : 'Buy this painting'}
                </button>
              )}
              {p.status === 'sold' && user?.role !== 'studio' && !action.feedback && (
                <p className="muted">This painting has been sold.</p>
              )}
              {user?.role === 'studio' && p.status === 'available' && (
                <button type="button" className="secondary" onClick={() => navigate(`/studio/paintings/${p.id}/edit`)}>
                  Edit painting
                </button>
              )}
              {user?.role === 'studio' && p.status === 'sold' && (
                <p className="muted">Sold paintings cannot be edited.</p>
              )}
            </div>
          </article>
        )}
      </AsyncView>
    </section>
  );
}
