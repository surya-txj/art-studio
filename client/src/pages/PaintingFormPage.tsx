import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Painting } from '../api/types';
import { AsyncView, ErrorBox } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

/** Studio: add a painting (/studio/paintings/new) or edit one (/studio/paintings/:id/edit). */
export function PaintingFormPage() {
  const { id } = useParams();
  const existing = useAsync(
    async () => (id ? (await api<{ painting: Painting }>(`/paintings/${encodeURIComponent(id)}`)).painting : null),
    [id],
  );

  return (
    <section className="narrow">
      <h1>{id ? 'Edit painting' : 'Add painting'}</h1>
      <AsyncView {...existing} onRetry={existing.reload}>
        {(p) =>
          p && p.status !== 'available' ? (
            <ErrorBox message="This painting has been sold and can no longer be edited." />
          ) : (
            <PaintingForm existing={p} />
          )
        }
      </AsyncView>
    </section>
  );
}

function PaintingForm({ existing }: { existing: Painting | null }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artist ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = { title, artist, description, price: Number(price), imageUrl };
    try {
      const res = existing
        ? await api<{ painting: Painting }>(`/paintings/${existing.id}`, { method: 'PATCH', body })
        : await api<{ painting: Painting }>('/paintings', { method: 'POST', body });
      navigate(`/paintings/${res.painting.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </label>
      <label>
        Artist
        <input value={artist} onChange={(e) => setArtist(e.target.value)} required maxLength={100} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} />
      </label>
      <label>
        Price (INR, whole rupees)
        <input type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
      </label>
      <label>
        Image URL <span className="muted">(optional; e.g. /images/p-001.jpg or https://…)</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} maxLength={500} />
      </label>
      {error && <ErrorBox message={error} />}
      <div className="row">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Add painting'}
        </button>
        <Link className="button secondary" to="/studio">
          Back to dashboard
        </Link>
      </div>
    </form>
  );
}
