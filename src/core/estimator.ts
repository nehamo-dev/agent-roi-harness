// Cost estimator: quotes a range from similar past tasks. Sees task features and past tasks only.
import { median } from './stats';
import type { Quote, Task, TaskFeatures } from './types';

export type MatchLevel = 'type+size+area' | 'type+size' | 'type' | 'all' | 'none';

export interface Estimate {
  quote: Quote;
  midpoint: number;
  confidence: 'normal' | 'low';
  level: MatchLevel;
  exactMatches: number;
  similar: Task[];
  assumptions: string[];
  risks: string[];
  areaRisk: string;
  poolSize: number; // past tasks the quote was drawn from
}

const MIN_POOL = 5;

// Range widening. Confidence depends on the type+size pool, because the model already adjusts for area.
export interface Calibration {
  normal: number; // sigma multiplier when the type+size pool has >= MIN_POOL tasks
  low: number; // sigma multiplier otherwise
}
// Chosen by `npm run calibrate` (fit July, validate August; September never read).
export const DEFAULT_CALIBRATION: Calibration = { normal: 1.4, low: 1.6 };
const Z80 = 1.2816; // 10th to 90th percentile
const COLD_START: Quote = { low: 2, high: 40 };

const AREA_RISK: Record<string, string> = {
  payments: 'Ledger module has thin test coverage; regressions surface late.',
  auth: 'Auth changes trigger a security review pass.',
  'web-frontend': 'Visual changes need manual review; agent may iterate on layout.',
  'data-pipeline': 'Backfills on large inputs can retry long-running commands.',
  platform: 'Shared infrastructure: changes fan out to other services.',
};

interface Model {
  mu: number;
  effects: Record<'type' | 'size' | 'repoArea' | 'developer', Record<string, number>>;
  sigma: number;
}

const KEYS = ['type', 'size', 'repoArea', 'developer'] as const;

function predictLog(m: Model, f: TaskFeatures): number {
  let y = m.mu;
  for (const k of KEYS) {
    const v = f[k];
    if (v !== undefined) y += m.effects[k][v] ?? 0;
  }
  return y;
}

// Additive model in log-cost space, fit by backfitting medians (robust to runaway runs).
export function fitModel(history: Task[]): Model {
  const ys = history.map((t) => Math.log(t.actualCost));
  const m: Model = { mu: median(ys), effects: { type: {}, size: {}, repoArea: {}, developer: {} }, sigma: 0.5 };
  for (let iter = 0; iter < 6; iter++) {
    for (const k of KEYS) {
      const groups: Record<string, number[]> = {};
      history.forEach((t, i) => {
        const others = predictLog(m, t) - (m.effects[k][t[k]] ?? 0);
        (groups[t[k]] ??= []).push(ys[i] - others);
      });
      for (const [v, r] of Object.entries(groups)) m.effects[k][v] = (median(r) * r.length) / (r.length + 3);
    }
  }
  const resid = history.map((t, i) => ys[i] - predictLog(m, t));
  const mad = median(resid.map((r) => Math.abs(r - median(resid))));
  m.sigma = Math.max(0.15, mad * 1.4826);
  return m;
}

export function estimate(f: TaskFeatures, pastTasks: Task[], cal: Calibration = DEFAULT_CALIBRATION): Estimate {
  const history = pastTasks.filter((t) => t.status === 'completed' && t.actualCost > 0);
  if (history.length < MIN_POOL) {
    return {
      quote: COLD_START, midpoint: Math.sqrt(COLD_START.low * COLD_START.high), confidence: 'low', level: 'none',
      exactMatches: 0, similar: [], assumptions: ['Cold start: fewer than 5 completed tasks in history; using a broad default range.'],
      risks: ['No history to compare against.'], areaRisk: AREA_RISK[f.repoArea], poolSize: 0,
    };
  }
  const model = fitModel(history);
  const exact = history.filter((t) => t.type === f.type && t.size === f.size && t.repoArea === f.repoArea);
  const pools: [MatchLevel, Task[]][] = [
    ['type+size+area', exact],
    ['type+size', history.filter((t) => t.type === f.type && t.size === f.size)],
    ['type', history.filter((t) => t.type === f.type)],
    ['all', history],
  ];
  const [level, pool] = pools.find(([, p]) => p.length >= MIN_POOL)!;

  // Residuals of the pool tell us whether this group runs above or below the model.
  const resid = pool.map((t) => Math.log(t.actualCost) - predictLog(model, t));
  const center = predictLog(model, f) + median(resid) * (pool.length / (pool.length + 3));
  const typeSize = pools[1][1].length;
  const lowConf = typeSize < MIN_POOL;
  const sigma = model.sigma * (lowConf ? cal.low : cal.normal);
  const low = Math.exp(center - Z80 * sigma);
  const high = Math.exp(center + Z80 * sigma);

  const similar = [...pool].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const midpoint = Math.exp(center);
  const assumptions = [
    `Based on ${pool.length} completed tasks matching ${level}${level !== 'type+size+area' ? `, adjusted for ${level === 'all' ? 'type, size and area' : level === 'type' ? 'size and area' : 'area'}` : ''}.`,
    'Range is the 10th to 90th percentile of similar past runs.',
  ];
  const devEff = f.developer ? model.effects.developer[f.developer] : undefined;
  if (devEff !== undefined && Math.abs(devEff) > 0.03) {
    assumptions.push(`${f.developer}'s past runs adjust the estimate by ${devEff > 0 ? '+' : ''}${Math.round((Math.exp(devEff) - 1) * 100)}%.`);
  }

  const risks: string[] = [];
  const blowups = pool.filter((t) => t.actualCost > 3 * high);
  if (blowups.length > 0) {
    risks.push(`${blowups.length} of ${pool.length} similar runs ran far over range (max $${Math.max(...blowups.map((t) => t.actualCost)).toFixed(0)}).`);
  }
  risks.push(AREA_RISK[f.repoArea]);
  if (f.size === 'L') risks.push('Large scope: the plan may need to split mid-run.');
  if (lowConf) risks.push(`Only ${typeSize} past ${typeSize === 1 ? 'task' : 'tasks'} of this type and size; range widened and confidence is low.`);

  return { quote: { low, high }, midpoint, confidence: lowConf ? 'low' : 'normal', level, exactMatches: exact.length, similar, assumptions, risks, areaRisk: AREA_RISK[f.repoArea], poolSize: pool.length };
}

export function width(q: Quote): number {
  return q.high / q.low;
}
