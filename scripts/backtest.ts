// E1: estimator backtest. Train on July-August, test on September. Synthetic data only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { estimate, width } from '../src/core/estimator';
import { mean, median } from '../src/core/stats';
import { generate, TEST_START } from '../src/data/generate';

const { tasks } = generate();
const done = tasks.filter((t) => t.status === 'completed');
const train = done.filter((t) => t.date < TEST_START);
const test = done.filter((t) => t.date >= TEST_START);

const inside = (c: number, lo: number, hi: number) => c >= lo && c <= hi;
const absPctErr = (pred: number, actual: number) => Math.abs(pred - actual) / actual;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const quotes = test.map((t) => estimate({ type: t.type, size: t.size, repoArea: t.repoArea, team: t.team, developer: t.developer }, train));
const coverage = mean(test.map((t, i) => (inside(t.actualCost, quotes[i].quote.low, quotes[i].quote.high) ? 1 : 0)));
const medWidth = median(quotes.map((q) => width(q.quote)));
const estErr = median(test.map((t, i) => absPctErr(quotes[i].midpoint, t.actualCost)));

const globalAvg = mean(train.map((t) => t.actualCost));
const avgBy = (key: 'developer' | 'type') => (v: string) => {
  const g = train.filter((t) => t[key] === v).map((t) => t.actualCost);
  return g.length ? mean(g) : globalAvg;
};
const devAvg = avgBy('developer');
const typeAvg = avgBy('type');
const errGlobal = median(test.map((t) => absPctErr(globalAvg, t.actualCost)));
const errDev = median(test.map((t) => absPctErr(devAvg(t.developer), t.actualCost)));
const errType = median(test.map((t) => absPctErr(typeAvg(t.type), t.actualCost)));

// Width-matched naive range: per-developer average, same median width as our quotes.
const half = Math.sqrt(medWidth);
const naiveCoverage = mean(test.map((t) => (inside(t.actualCost, devAvg(t.developer) / half, devAvg(t.developer) * half) ? 1 : 0)));

// Costliest 5% of test tasks.
const nTop = Math.max(1, Math.ceil(test.length * 0.05));
const topIdx = test.map((t, i) => [t.actualCost, i] as const).sort((a, b) => b[0] - a[0]).slice(0, nTop).map(([, i]) => i);
const topCoverage = mean(topIdx.map((i) => (inside(test[i].actualCost, quotes[i].quote.low, quotes[i].quote.high) ? 1 : 0)));

const errReduction = 1 - estErr / errDev;
const pass1 = coverage >= 0.8 && medWidth <= 2.0;
const pass2 = errReduction >= 0.3;
const pass3 = coverage > naiveCoverage;
const status = (p: boolean) => (p ? 'PASS' : 'MISS');

const lines = [
  '# E1 estimator backtest',
  '',
  '> SYNTHETIC DATA. These numbers show the mechanism works on seeded data. They do not show real-world accuracy.',
  '',
  `Train: ${train.length} completed tasks (before ${TEST_START}). Test: ${test.length} completed tasks (September).`,
  '',
  '| Metric | Value | Threshold | Status |',
  '|---|---|---|---|',
  `| Coverage (actual inside quote) | ${pct(coverage)} | >= 80% with width <= 2.0x | ${status(pass1)} |`,
  `| Median range width (high/low) | ${medWidth.toFixed(2)}x | <= 2.0x | (part of above) |`,
  `| Median abs % error, estimator midpoint | ${pct(estErr)} | | |`,
  `| Median abs % error, global average | ${pct(errGlobal)} | baseline | |`,
  `| Median abs % error, per-developer average | ${pct(errDev)} | baseline | |`,
  `| Median abs % error, per-type average | ${pct(errType)} | baseline | |`,
  `| Error reduction vs per-developer average | ${pct(errReduction)} | >= 30% | ${status(pass2)} |`,
  `| Width-matched naive coverage (per-dev avg, ${medWidth.toFixed(2)}x) | ${pct(naiveCoverage)} | estimator coverage must be higher | ${status(pass3)} |`,
  `| Coverage on costliest 5% (${nTop} tasks) | ${pct(topCoverage)} | report only | |`,
  `| Low-confidence quotes in test | ${quotes.filter((q) => q.confidence === 'low').length} of ${quotes.length} | report only | |`,
];
const out = lines.join('\n') + '\n';
console.log(out);
mkdirSync('eval-results', { recursive: true });
writeFileSync('eval-results/e1-backtest.md', out);
console.log('Saved eval-results/e1-backtest.md');
