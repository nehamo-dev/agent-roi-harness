export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const median = (v: number[]) => quantile(v, 0.5);
export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
export const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;
