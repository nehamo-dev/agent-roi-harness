// Spend forecast from weekly history: bootstrap resampling of recent weeks, so the heavy tail shows up in the range.
import { makeRng } from './rng';
import { quantile } from './stats';
import type { Task } from './types';

export interface Week {
  start: string; // Monday, YYYY-MM-DD
  spend: number;
}

function monday(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function weeklySpend(tasks: Task[]): Week[] {
  const m = new Map<string, number>();
  for (const t of tasks) if (t.actualCost > 0) m.set(monday(t.date), (m.get(monday(t.date)) ?? 0) + t.actualCost);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, spend]) => ({ start, spend }));
}

export interface Forecast {
  low: number;
  mid: number;
  high: number;
  horizonWeeks: number;
  basisWeeks: number;
}

export const FORECAST_LOOKBACK = 8;

export function forecast(history: Week[], horizonWeeks: number, seed = 7, draws = 2000): Forecast {
  const basis = history.slice(-FORECAST_LOOKBACK).map((w) => w.spend);
  const rng = makeRng(seed);
  const sums: number[] = [];
  for (let i = 0; i < draws; i++) {
    let s = 0;
    for (let h = 0; h < horizonWeeks; h++) s += basis[Math.floor(rng() * basis.length)];
    sums.push(s);
  }
  return { low: quantile(sums, 0.1), mid: quantile(sums, 0.5), high: quantile(sums, 0.9), horizonWeeks, basisWeeks: basis.length };
}
