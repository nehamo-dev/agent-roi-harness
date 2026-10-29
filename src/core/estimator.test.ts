import { describe, expect, it } from 'vitest';
import { estimate } from './estimator';
import type { Task } from './types';

let n = 0;
function task(p: Partial<Task>): Task {
  n++;
  return {
    id: `T${n}`, team: 'A', developer: 'dev', initiative: 'I', capability: 'C', type: 'bugfix', size: 'M',
    repoArea: 'payments', quote: { low: 0, high: 0 }, actualCost: 5, eventLogId: null, status: 'completed',
    justified: 'unset', prNumber: n, date: `2026-07-${String((n % 28) + 1).padStart(2, '0')}`, ...p,
  };
}

const history: Task[] = [
  ...[4, 5, 6, 5, 4.5, 5.5].map((c) => task({ type: 'bugfix', size: 'M', repoArea: 'payments', actualCost: c })),
  ...[18, 22, 20, 25, 19, 21].map((c) => task({ type: 'feature', size: 'L', repoArea: 'payments', actualCost: c })),
  ...[2, 2.5, 3, 2.2, 2.8].map((c) => task({ type: 'tests', size: 'S', repoArea: 'web-frontend', actualCost: c })),
];

describe('estimator', () => {
  it('quotes a range around similar past tasks', () => {
    const e = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, history);
    expect(e.quote.low).toBeLessThan(5);
    expect(e.quote.high).toBeGreaterThan(5);
    expect(e.level).toBe('type+size+area');
    expect(e.confidence).toBe('normal');
    expect(e.similar.length).toBeGreaterThan(0);
  });

  it('orders quotes by expected cost', () => {
    const small = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, history);
    const big = estimate({ type: 'feature', size: 'L', repoArea: 'payments' }, history);
    expect(big.midpoint).toBeGreaterThan(small.midpoint * 2);
  });

  it('flags sparse combinations as low confidence with a wider range', () => {
    const dense = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, history);
    const sparse = estimate({ type: 'migration', size: 'S', repoArea: 'auth' }, history);
    expect(sparse.confidence).toBe('low');
    expect(sparse.quote.high / sparse.quote.low).toBeGreaterThan(dense.quote.high / dense.quote.low);
    expect(Number.isFinite(sparse.quote.low) && Number.isFinite(sparse.quote.high)).toBe(true);
  });

  it('returns a cold-start range with no history', () => {
    const e = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, []);
    expect(e.level).toBe('none');
    expect(e.confidence).toBe('low');
  });

  it('ignores tasks that are not completed', () => {
    const withRunning = [...history, task({ type: 'bugfix', size: 'M', repoArea: 'payments', actualCost: 500, status: 'running' })];
    const a = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, history);
    const b = estimate({ type: 'bugfix', size: 'M', repoArea: 'payments' }, withRunning);
    expect(b.quote).toEqual(a.quote);
  });
});
