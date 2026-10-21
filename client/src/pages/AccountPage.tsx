import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Order, PotteryRequest, StudioInfo } from '../api/types';
import { FeedbackMessage } from '../components/Layout';
import { AsyncView, StatusBadge, Success } from '../components/Status';
import { useAction } from '../hooks/useAction';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatMoney } from '../lib/format';

const daysUntil = (today: string, date: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

/** Customer dashboard: their own orders, bookings and pottery requests. */
export function AccountPage() {
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  const action = useAction();
  const orders = useAsync(() => api<{ orders: Order[] }>('/orders'));
  const bookings = useAsync(async () => {
    const [list, info] = await Promise.all([api<{ bookings: Booking[] }>('/bookings'), api<StudioInfo>('/studio/info')]);
    return { bookings: list.bookings, today: info.today, cutoff: info.booking.cancelUntilDaysBefore };
  });
  const pottery = useAsync(() => api<{ requests: PotteryRequest[] }>('/pottery-requests'));

  async function cancel(kind: 'order' | 'booking' | 'pottery', id: number, reload: () => void) {
    const label = { order: 'order', booking: 'booking', pottery: 'pottery request' }[kind];
    if (!window.confirm(`Cancel this ${label}? This cannot be undone.`)) return;
    const path = { order: '/orders', booking: '/bookings', pottery: '/pottery-requests' }[kind];
    await action.run(`${kind}-${id}`, () => api(`${path}/${id}/cancel`, { method: 'POST' }), `The ${label} was cancelled.`);
    reload(); // show the real state either way
  }

  return (
    <section>
      <h1>My account</h1>
      {flash && !action.feedback && <Success>{flash}</Success>}
      <FeedbackMessage feedback={action.feedback} />

      <h2>Painting orders</h2>
      <AsyncView
        {...orders}
        onRetry={orders.reload}
        isEmpty={(d) => d.orders.length === 0}
        empty={
          <>
            No orders yet. <Link to="/">Browse paintings</Link>
          </>
        }
      >
        {(d) => (
          <table>
            <thead>
              <tr>
                <th>Painting</th>
                <th>Price</th>
                <th>Ordered</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/paintings/${o.paintingId}`}>{o.paintingTitle}</Link>
                  </td>
                  <td>{formatMoney(o.price)}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    {o.status === 'placed' && (
                      <button
                        type="button"
                        className="danger"
                        disabled={action.pending === `order-${o.id}`}
                        onClick={() => cancel('order', o.id, orders.reload)}
                      >
                        Cancel order
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>

      <h2>Wall bookings</h2>
      <AsyncView
        {...bookings}
        onRetry={bookings.reload}
        isEmpty={(d) => d.bookings.length === 0}
        empty={
          <>
            No bookings yet. <Link to="/wall-booking">Book a wall</Link>
          </>
        }
      >
        {(d) => (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Wall</th>
                <th>Address</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.bookings.map((b) => {
                const active = b.status === 'requested' || b.status === 'confirmed';
                const tooLate = daysUntil(d.today, b.date) < d.cutoff;
                return (
                  <tr key={b.id}>
                    <td>{formatDate(b.date)}</td>
                    <td>{b.wallSizeSqft} sq ft</td>
                    <td className="wrap">{b.address}</td>
                    <td>{formatMoney(b.price)}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      {active && !tooLate && (
                        <button
                          type="button"
                          className="danger"
                          disabled={action.pending === `booking-${b.id}`}
                          onClick={() => cancel('booking', b.id, bookings.reload)}
                        >
                          Cancel booking
                        </button>
                      )}
                      {active && tooLate && (
                        <span className="muted">Too close to the date to cancel</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AsyncView>

      <h2>Pottery requests</h2>
      <AsyncView
        {...pottery}
        onRetry={pottery.reload}
        isEmpty={(d) => d.requests.length === 0}
        empty={
          <>
            No pottery requests yet. <Link to="/pottery/new">Request pottery</Link>
          </>
        }
      >
        {(d) => (
          <table>
            <thead>
              <tr>
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
                        <Link className="button secondary" to={`/pottery/${r.id}/edit`}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="danger"
                          disabled={action.pending === `pottery-${r.id}`}
                          onClick={() => cancel('pottery', r.id, pottery.reload)}
                        >
                          Cancel
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
    </section>
  );
}
