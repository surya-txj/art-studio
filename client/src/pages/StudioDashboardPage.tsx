import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Order, Painting, PotteryRequest } from '../api/types';
import { FeedbackMessage } from '../components/Layout';
import { AsyncView, ErrorBox, StatusBadge } from '../components/Status';
import { useAction } from '../hooks/useAction';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatMoney } from '../lib/format';

type Tab = 'bookings' | 'pottery' | 'orders' | 'paintings';

/** Studio (admin) dashboard: review everything and make decisions. */
export function StudioDashboardPage() {
  const [tab, setTab] = useState<Tab>('bookings');
  // Counts for the summary tiles. Re-fetched whenever the tab changes, so
  // decisions made on a tab are reflected when you switch.
  const summary = useAsync(async () => {
    const [b, r, o, p] = await Promise.all([
      api<{ bookings: Booking[] }>('/bookings'),
      api<{ requests: PotteryRequest[] }>('/pottery-requests'),
      api<{ orders: Order[] }>('/orders'),
      api<{ paintings: Painting[] }>('/paintings'),
    ]);
    return {
      pendingBookings: b.bookings.filter((x) => x.status === 'requested').length,
      pendingPottery: r.requests.filter((x) => x.status === 'requested').length,
      placedOrders: o.orders.filter((x) => x.status === 'placed').length,
      available: p.paintings.filter((x) => x.status === 'available').length,
    };
  }, [tab]);
  const s = summary.data;

  const tabs: [Tab, string, number | undefined][] = [
    ['bookings', 'Wall bookings', s?.pendingBookings],
    ['pottery', 'Pottery requests', s?.pendingPottery],
    ['orders', 'Orders', undefined],
    ['paintings', 'Paintings', undefined],
  ];

  return (
    <section>
      <p className="eyebrow">Studio</p>
      <h1>Dashboard</h1>

      {summary.error && <ErrorBox message={summary.error} onRetry={summary.reload} />}
      <div className="stats">
        <Stat label="Bookings awaiting a decision" value={s?.pendingBookings} highlight={!!s?.pendingBookings} />
        <Stat label="Pottery requests awaiting a decision" value={s?.pendingPottery} highlight={!!s?.pendingPottery} />
        <Stat label="Active painting orders" value={s?.placedOrders} />
        <Stat label="Paintings available" value={s?.available} />
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => setTab(key)}
          >
            {label}
            {!!count && <span className="count" aria-label={`${count} pending`}>{count}</span>}
          </button>
        ))}
      </div>
      {tab === 'bookings' && <BookingsReview onChange={summary.reload} />}
      {tab === 'pottery' && <PotteryReview onChange={summary.reload} />}
      {tab === 'orders' && <OrdersList />}
      {tab === 'paintings' && <PaintingsManage />}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | undefined; highlight?: boolean }) {
  return (
    <div className={highlight ? 'stat highlight' : 'stat'}>
      <div className="stat-value">{value ?? '–'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function BookingsReview({ onChange }: { onChange: () => void }) {
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
    onChange();
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
          <div className="table-wrap">
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
                    
                    <span className="sub">{b.customerEmail}</span>
                  </td>
                  <td>{b.wallSizeSqft} sq ft</td>
                  <td className="wrap">{b.address}</td>
                  <td>{formatMoney(b.price)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td>
                    <div className="row">
                      {b.status === 'requested' && (
                        <>
                          <button type="button" className="small" disabled={action.pending !== null} onClick={() => decide(b, 'confirm')}>
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="danger small"
                            disabled={action.pending !== null}
                            onClick={() => decide(b, 'decline')}
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </AsyncView>
    </>
  );
}

function PotteryReview({ onChange }: { onChange: () => void }) {
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
    onChange();
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
          <div className="table-wrap">
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
                    
                    <span className="sub">{r.customerEmail}</span>
                  </td>
                  <td>{r.itemName}</td>
                  <td>{r.glazeName}</td>
                  <td>{r.quantity}</td>
                  <td>{formatDate(r.neededBy)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <div className="row">
                      {r.status === 'requested' && (
                        <>
                          <button type="button" className="small" disabled={action.pending !== null} onClick={() => decide(r, 'accept')}>
                            Accept
                          </button>
                          <button
                            type="button"
                            className="danger small"
                            disabled={action.pending !== null}
                            onClick={() => decide(r, 'decline')}
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
        <div className="table-wrap">
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
                <td className="wrap">
                  <Link to={`/paintings/${o.paintingId}`}>{o.paintingTitle}</Link>
                </td>
                <td>
                  {o.customerName}
                  
                  <span className="sub">{o.customerEmail}</span>
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
        </div>
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
          + Add painting
        </Link>
      </p>
      <AsyncView
        {...paintings}
        onRetry={paintings.reload}
        isEmpty={(d) => d.paintings.length === 0}
        empty="No paintings yet."
      >
        {(d) => (
          <div className="table-wrap">
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
                      <Link className="button secondary small" to={`/studio/paintings/${p.id}/edit`}>
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
          </div>
        )}
      </AsyncView>
    </>
  );
}
