import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Booking, StudioInfo } from '../api/types';
import { AsyncView, ErrorBox, Success } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatMoney } from '../lib/format';

export function WallBookingPage() {
  const info = useAsync(async () => {
    const [studio, taken] = await Promise.all([
      api<StudioInfo>('/studio/info'),
      api<{ dates: string[] }>('/bookings/unavailable-dates'),
    ]);
    return { studio, takenDates: taken.dates };
  });

  return (
    <section className="narrow">
      <h1>Book a wall painting</h1>
      <AsyncView {...info} onRetry={info.reload}>
        {(d) => <BookingForm studio={d.studio} takenDates={d.takenDates} onBooked={info.reload} />}
      </AsyncView>
    </section>
  );
}

function BookingForm({
  studio,
  takenDates,
  onBooked,
}: {
  studio: StudioInfo;
  takenDates: string[];
  onBooked: () => void;
}) {
  const rules = studio.booking;
  const [date, setDate] = useState('');
  const [size, setSize] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sizeNumber = Number(size);
  const sizeValid = Number.isInteger(sizeNumber) && sizeNumber >= rules.minWallSqft && sizeNumber <= rules.maxWallSqft;
  const dateTaken = takenDates.includes(date);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const res = await api<{ booking: Booking }>('/bookings', {
        method: 'POST',
        body: { date, wallSizeSqft: sizeNumber, address },
      });
      setCreated(res.booking);
      setDate('');
      setSize('');
      setAddress('');
      onBooked();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="muted">
        Pick a date between {formatDate(rules.earliestDate)} and {formatDate(rules.latestDate)}. The price is the wall
        size × {formatMoney(studio.muralRatePerSqFt)} per sq ft. You can cancel until {rules.cancelUntilDaysBefore} days
        before the date.
      </p>
      {created && (
        <Success>
          Booking requested for {formatDate(created.date)} — {formatMoney(created.price)}. The studio will confirm it.{' '}
          <Link to="/account">View my bookings</Link>
        </Success>
      )}
      <form onSubmit={onSubmit} className="form">
        <label>
          Date
          <input
            type="date"
            value={date}
            min={rules.earliestDate}
            max={rules.latestDate}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-describedby="date-help"
          />
        </label>
        <span id="date-help" className={dateTaken ? 'field-error' : 'muted'}>
          {dateTaken
            ? 'This date is already booked. Please choose another date.'
            : takenDates.length > 0
              ? `Already booked: ${takenDates.map(formatDate).join(', ')}`
              : 'No dates are booked yet.'}
        </span>
        <label>
          Wall size (sq ft, {rules.minWallSqft}–{rules.maxWallSqft})
          <input
            type="number"
            inputMode="numeric"
            min={rules.minWallSqft}
            max={rules.maxWallSqft}
            step={1}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
          />
        </label>
        <label>
          Address
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} required maxLength={500} rows={3} />
        </label>
        <p>
          Estimated price:{' '}
          <strong>{sizeValid ? formatMoney(sizeNumber * studio.muralRatePerSqFt) : '—'}</strong>{' '}
          <span className="muted">(the server calculates the final price)</span>
        </p>
        {error && <ErrorBox message={error} />}
        <button type="submit" disabled={submitting || dateTaken}>
          {submitting ? 'Booking…' : 'Request booking'}
        </button>
      </form>
    </>
  );
}
