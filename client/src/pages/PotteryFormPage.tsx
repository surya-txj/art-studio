import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Option, PotteryRequest, StudioInfo } from '../api/types';
import { AsyncView, ErrorBox, Success } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../lib/format';

/** Used for both "new request" (/pottery/new) and "edit request" (/pottery/:id/edit). */
export function PotteryFormPage() {
  const { id } = useParams();
  const editing = id !== undefined;
  const data = useAsync(async () => {
    const [studio, options, existing] = await Promise.all([
      api<StudioInfo>('/studio/info'),
      api<{ items: Option[]; glazes: Option[] }>('/pottery-options'),
      editing ? api<{ request: PotteryRequest }>(`/pottery-requests/${id}`).then((r) => r.request) : null,
    ]);
    return { studio, options, existing };
  }, [id]);

  return (
    <section className="narrow">
      <h1>{editing ? 'Edit pottery request' : 'Request custom pottery'}</h1>
      <AsyncView {...data} onRetry={data.reload}>
        {(d) =>
          d.existing && d.existing.status !== 'requested' ? (
            <ErrorBox message={`This request can no longer be edited because it is ${d.existing.status}.`} />
          ) : (
            <PotteryForm {...d} />
          )
        }
      </AsyncView>
    </section>
  );
}

function PotteryForm({
  studio,
  options,
  existing,
}: {
  studio: StudioInfo;
  options: { items: Option[]; glazes: Option[] };
  existing: PotteryRequest | null;
}) {
  const rules = studio.pottery;
  const navigate = useNavigate();
  const [itemId, setItemId] = useState(existing?.itemId ?? '');
  const [glazeId, setGlazeId] = useState(existing?.glazeId ?? '');
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 1));
  const [neededBy, setNeededBy] = useState(existing?.neededBy ?? '');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PotteryRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = { itemId, glazeId, quantity: Number(quantity), neededBy };
    try {
      if (existing) {
        await api(`/pottery-requests/${existing.id}`, { method: 'PATCH', body });
        navigate('/account', { state: { flash: 'Pottery request updated.' } });
      } else {
        const res = await api<{ request: PotteryRequest }>('/pottery-requests', { method: 'POST', body });
        setCreated(res.request);
        setItemId('');
        setGlazeId('');
        setQuantity('1');
        setNeededBy('');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {created && (
        <Success>
          Requested {created.quantity} × {created.itemName} in {created.glazeName}, needed by{' '}
          {formatDate(created.neededBy)}. <Link to="/account">View my requests</Link>
        </Success>
      )}
      <form onSubmit={onSubmit} className="form">
        <label>
          Item
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            <option value="">Choose an item…</option>
            {options.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Glaze
          <select value={glazeId} onChange={(e) => setGlazeId(e.target.value)} required>
            <option value="">Choose a glaze…</option>
            {options.glazes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity ({rules.minQuantity}–{rules.maxQuantity})
          <input
            type="number"
            min={rules.minQuantity}
            max={rules.maxQuantity}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label>
          Needed by (on or after {formatDate(rules.earliestNeededBy)})
          <input
            type="date"
            min={rules.earliestNeededBy}
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            required
          />
        </label>
        {error && <ErrorBox message={error} />}
        <div className="row">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : existing ? 'Save changes' : 'Send request'}
          </button>
          {existing && (
            <Link to="/account" className="button secondary">
              Cancel editing
            </Link>
          )}
        </div>
      </form>
    </>
  );
}
