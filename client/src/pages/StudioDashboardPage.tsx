import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Order, Painting, PotteryRequest } from '../api/types';
import { FeedbackMessage } from '../components/Layout';
import { AsyncView, StatusBadge } from '../components/Status';
import { useAction } from '../hooks/useAction';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatMoney } from '../lib/format';

type Tab = 'bookings' | 'pottery' | 'orders' | 'paintings';

/** Studio (admin) dashboard: review everything and make decisions. */
export function StudioDashboardPage() {
  const [tab, setTab] = useState<Tab>('bookings');
  const tabs: [Tab, string][] = [
    ['bookings', 'Wall bookings'],
    ['pottery', 'Pottery requests'],
    ['orders', 'Orders'],
    ['paintings', 'Paintings'],
  ];

  return (
    <section>
      <h1>Studio dashboard</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'bookings' && <BookingsReview />}
      {tab === 'pottery' && <PotteryReview />}
      {tab === 'orders' && <OrdersList />}
      {tab === 'paintings' && <PaintingsManage />}
    </section>
  );
}

function BookingsReview() {
  const bookings = useAsync(() => api<{ bookings: Booking[] }>('/bookings'));
  const action = useAction();

  async function decide(b: Booking, decision: 'confirm' | 'decline') {
    if (decision === 'decline' && !window.confirm(`Decline the booking for ${formatDate(b.date)}?`)) return;
    await action.run(
      `${decision}-${b.id}`,
      () => api(`/bookings/${b.id}/${decision}`, { method: 'POST' }),
      `Booking for ${formatDate(b.date)} ${decision === 'confirm' ? 'confirmed' : 'declined'}.`,
    );
    bookings.reload();
  }

  return (
    <>
      <FeedbackMessage feedback={action.feedback} />
      <AsyncView
        {...bookings}
        onRetry={bookings.reload}
        isEmpty={(d) => d.bookings.length === 0}
        empty="No wall bookings yet."
      >
        {(d) => (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Wall</th>
                <th>Address</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.bookings.map((b) => (
                <tr key={b.id}>
                  <td>{formatDate(b.date)}</td>
                  <td>
                    {b.customerName}
                    <br />
                    <span className="muted">{b.customerEmail}</span>
                  </td>
                  <td>{b.wallSizeSqft} sq ft</td>
                  <td className="wrap">{b.address}</td>
                  <td>{formatMoney(b.price)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="row">
                    {b.status === 'requested' && (
                      <>
                        <button type="button" disabled={action.pending !== null} onClick={() => decide(b, 'confirm')}>
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={action.pending !== null}
                          onClick={() => decide(b, 'decline')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>
    </>
  );
}

function PotteryReview() {
  const requests = useAsync(() => api<{ requests: PotteryRequest[] }>('/pottery-requests'));
  const action = useAction();

  async function decide(r: PotteryRequest, decision: 'accept' | 'decline') {
    if (decision === 'decline' && !window.confirm(`Decline ${r.customerName}'s request for ${r.itemName}?`)) return;
    await action.run(
      `${decision}-${r.id}`,
      () => api(`/pottery-requests/${r.id}/${decision}`, { method: 'POST' }),
      `Request ${decision === 'accept' ? 'accepted' : 'declined'}.`,
    );
    requests.reload();
  }

  return (
    <>
      <FeedbackMessage feedback={action.feedback} />
      <AsyncView
        {...requests}
        onRetry={requests.reload}
        isEmpty={(d) => d.requests.length === 0}
        empty="No pottery requests yet."
      >
        {(d) => (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Item</th>
                <th>Glaze</th>
                <th>Qty</th>
                <th>Needed by</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.customerName}
                    <br />
                    <span className="muted">{r.customerEmail}</span>
                  </td>
                  <td>{r.itemName}</td>
                  <td>{r.glazeName}</td>
                  <td>{r.quantity}</td>
                  <td>{formatDate(r.neededBy)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="row">
                    {r.status === 'requested' && (
                      <>
                        <button type="button" disabled={action.pending !== null} onClick={() => decide(r, 'accept')}>
                          Accept
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={action.pending !== null}
                          onClick={() => decide(r, 'decline')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>
    </>
  );
}

function OrdersList() {
  const orders = useAsync(() => api<{ orders: Order[] }>('/orders'));
  return (
    <AsyncView {...orders} onRetry={orders.reload} isEmpty={(d) => d.orders.length === 0} empty="No orders yet.">
      {(d) => (
        <table>
          <thead>
            <tr>
              <th>Painting</th>
              <th>Customer</th>
              <th>Price</th>
              <th>Ordered</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/paintings/${o.paintingId}`}>{o.paintingTitle}</Link>
                </td>
                <td>
                  {o.customerName}
                  <br />
                  <span className="muted">{o.customerEmail}</span>
                </td>
                <td>{formatMoney(o.price)}</td>
                <td>{formatDate(o.createdAt)}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AsyncView>
  );
}

function PaintingsManage() {
  const paintings = useAsync(() => api<{ paintings: Painting[] }>('/paintings'));
  return (
    <>
      <p>
        <Link className="button" to="/studio/paintings/new">
          Add painting
        </Link>
      </p>
      <AsyncView
        {...paintings}
        onRetry={paintings.reload}
        isEmpty={(d) => d.paintings.length === 0}
        empty="No paintings yet."
      >
        {(d) => (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.paintings.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td className="wrap">
                    <Link to={`/paintings/${p.id}`}>{p.title}</Link>
                  </td>
                  <td>{p.artist}</td>
                  <td>{formatMoney(p.price)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    {p.status === 'available' ? (
                      <Link className="button secondary" to={`/studio/paintings/${p.id}/edit`}>
                        Edit
                      </Link>
                    ) : (
                      <span className="muted">Sold — locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>
    </>
  );
}
