// Calibrates range widening using training data only: fit on July, validate on August.
// September (the E1 test month) is never read here.
import { estimate, width } from '../src/core/estimator';
import { mean, median } from '../src/core/stats';
import { generate, TEST_START } from '../src/data/generate';

const done = generate().tasks.filter((t) => t.status === 'completed' && t.date < TEST_START);
const fit = done.filter((t) => t.date < '2026-08-01');
const val = done.filter((t) => t.date >= '2026-08-01');
console.log(`Fit (July): ${fit.length} tasks · Validate (August): ${val.length} tasks · Target: 80% coverage`);
// Selection rule (fixed before running on September): August coverage closest to 80%; ties go to the narrower range.
const rows: { normal: number; low: number; cov: number; w: number; lowShare: number }[] = [];
for (const normal of [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6]) {
  for (const low of [1.2, 1.4, 1.6, 1.8]) {
    const qs = val.map((t) => estimate({ type: t.type, size: t.size, repoArea: t.repoArea, team: t.team, developer: t.developer }, fit, { normal, low }));
    const cov = mean(val.map((t, i) => (t.actualCost >= qs[i].quote.low && t.actualCost <= qs[i].quote.high ? 1 : 0)));
    rows.push({ normal, low, cov, w: median(qs.map((q) => width(q.quote))), lowShare: mean(qs.map((q) => (q.confidence === 'low' ? 1 : 0))) });
  }
}
rows.sort((a, b) => Math.abs(a.cov - 0.8) - Math.abs(b.cov - 0.8) || a.w - b.w);
console.log('normal  low   coverage  med width  low-conf share');
for (const r of rows.slice(0, 6)) {
  console.log(`${r.normal.toFixed(1).padEnd(7)} ${r.low.toFixed(1).padEnd(5)} ${(r.cov * 100).toFixed(1).padStart(6)}%   ${r.w.toFixed(2)}x     ${(r.lowShare * 100).toFixed(0)}%`);
}
console.log(`Chosen: normal ${rows[0].normal}, low ${rows[0].low}`);
