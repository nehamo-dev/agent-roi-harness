export const usd = (n: number) => `$${n < 1000 ? n.toFixed(2) : Math.round(n).toLocaleString('en-US')}`;

// Compact amounts for org-scale figures: $2.3M, $412K, $86, $10.48.
export function money(n: number): string {
  const a = Math.abs(n);
  if (a < 0.005) return '$0';
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  if (a >= 100) return `${sign}$${Math.round(a)}`;
  return `${sign}$${a.toFixed(2)}`;
}

// A range whose ends stay distinct after compact rounding.
export function moneyRange(lo: number, hi: number): string {
  const a = money(lo);
  const b = money(hi);
  if (a !== b || hi < 1e6) return `${a} – ${b}`;
  return `$${(lo / 1e6).toFixed(2)}M – $${(hi / 1e6).toFixed(2)}M`;
}
