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

  // Guests are sent to sign up first; the service pages need a customer account.
  const customerLink = (path: string) => (user?.role === 'customer' ? path : user ? null : '/register');

  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Handmade in India</p>
        <h1>Original art from living traditions</h1>
        <p>
          One-of-a-kind paintings in Madhubani, Tanjore, Gond, Kalamkari and more — plus hand-painted walls and
          custom pottery made to order.
        </p>
        <div className="row">
          <a href="#collection" className="button large">
            Browse the collection
          </a>
          {!user && (
            <Link to="/register" className="button secondary large">
              Create an account
            </Link>
          )}
          {user?.role === 'studio' && (
            <Link to="/studio" className="button secondary large">
              Open studio dashboard
            </Link>
          )}
        </div>
      </div>

      <div className="services">
        <ServiceCard
          icon="🖼️"
          title="Original paintings"
          text="Every piece is unique and can be bought only once."
          link="#collection"
          linkText="See the collection"
        />
        <ServiceCard
          icon="🎨"
          title="Wall painting"
          text="Book a date 7–90 days ahead for a mural on your wall, priced per square foot."
          link={customerLink('/wall-booking')}
          linkText="Book a wall"
        />
        <ServiceCard
          icon="🏺"
          title="Custom pottery"
          text="Choose an item and glaze, 1–12 pieces, ready at least 14 days from today."
          link={customerLink('/pottery/new')}
          linkText="Request pottery"
        />
      </div>

      <div className="page-head" id="collection">
        <div>
          <p className="eyebrow">The collection</p>
          <h2>Paintings</h2>
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="Filter paintings">
            {(['all', 'available', 'sold'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'available' ? 'Available' : 'Sold'}
              </button>
            ))}
          </div>
          {user?.role === 'studio' && (
            <Link className="button" to="/studio/paintings/new">
              + Add painting
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
              <li key={p.id} className={p.status === 'sold' ? 'card is-sold' : 'card'}>
                <Link to={`/paintings/${p.id}`} className="card-media" tabIndex={-1} aria-hidden="true">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <div className="img-placeholder">No image</div>}
                  {p.status === 'sold' && <span className="ribbon">Sold</span>}
                </Link>
                <div className="card-body">
                  <h3 className="card-title">
                    <Link to={`/paintings/${p.id}`}>{p.title}</Link>
                  </h3>
                  <span className="muted">{p.artist}</span>
                  <div className="card-footer">
                    <span className="card-price">{formatMoney(p.price)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </section>
  );
}

function ServiceCard(props: { icon: string; title: string; text: string; link: string | null; linkText: string }) {
  return (
    <div className="service">
      <span className="service-icon" aria-hidden="true">
        {props.icon}
      </span>
      <h3>{props.title}</h3>
      <p>{props.text}</p>
      {props.link?.startsWith('#') ? (
        <a href={props.link}>{props.linkText} →</a>
      ) : props.link ? (
        <Link to={props.link}>{props.linkText} →</Link>
      ) : (
        <span className="muted">For customers</span>
      )}
    </div>
  );
}
