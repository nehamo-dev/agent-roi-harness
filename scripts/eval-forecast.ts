// E5: rolling-origin forecast backtest. For each of the last weeks, forecast from earlier weeks only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { forecast } from '../src/core/forecast';
import { orgWeekly } from '../src/core/selectors';
import { mean } from '../src/core/stats';
import { buildDataset } from '../src/data/dataset';

const BACKTEST_WEEKS = 6; // weeks 8-13 of the quarter; each forecast uses only earlier weeks
// Org-scale weekly spend, same basis as the CFO forecast: ongoing work, excluding one-off spend and the paused capability.
const ds = buildDataset();
const weeks = orgWeekly({ ...ds, pausedDecision: null }).map((w) => ({ start: w.start, spend: w.spend - w.oneOff - w.paused }));
const rows = weeks.slice(-BACKTEST_WEEKS).map((w) => {
  const idx = weeks.indexOf(w);
  const f = forecast(weeks.slice(0, idx), 1);
  return { week: w.start, actual: w.spend, low: f.low, high: f.high, inside: w.spend >= f.low && w.spend <= f.high, width: (f.high - f.low) / w.spend };
});
const cov = mean(rows.map((r) => (r.inside ? 1 : 0)));
const out = [
  '# E5 forecast reliability (rolling origin)',
  '',
  '> SYNTHETIC DATA. Each week is forecast from the weeks before it only (bootstrap of up to 8 prior weeks, 10th-90th percentile). Report-only target: 70% of weeks inside.',
  '',
  '| Week of | Actual | Forecast range | Inside | Range width / actual |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.week} | $${(r.actual / 1e3).toFixed(0)}K | $${(r.low / 1e3).toFixed(0)}K – $${(r.high / 1e3).toFixed(0)}K | ${r.inside ? 'yes' : 'no'} | ${r.width.toFixed(2)}x |`),
  '',
  `Weeks inside range: ${rows.filter((r) => r.inside).length}/${rows.length} (${(cov * 100).toFixed(0)}%) · ${cov >= 0.7 ? 'meets' : 'misses'} 70% target`,
  `Average range width relative to actual spend: ${mean(rows.map((r) => r.width)).toFixed(2)}x`,
].join('\n') + '\n';
console.log(out);
mkdirSync('eval-results', { recursive: true });
writeFileSync('eval-results/e5-forecast.md', out);
console.log('Saved eval-results/e5-forecast.md');
