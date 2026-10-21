const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatMoney = (amount: number) => inr.format(amount);

/** "2026-11-15" → "15 Nov 2026". Parsed as UTC so the day never shifts. */
export function formatDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
