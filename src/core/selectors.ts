// Derived numbers every view reads. Pure functions over the shared state, so all views agree.
import type { DemoState } from './reducer';
import { estimate } from './estimator';
import { AUTO_APPROVE_LIMIT } from './session';
import { mean, median, sum } from './stats';
import type { CapabilityAggregate, Task } from './types';
import type { DecisionKey } from './decision';
import { forecast } from './forecast';
import { PAUSED_SCENARIO } from '../data/pausedScenario';

export const OFF_PLAN_MIN_OVER = 5; // dollars over the quote ceiling before a run is surfaced
export const IN_FLIGHT_CAP_MULT = 3;
export const TEST_START = '2026-09-01';

export const spendTasks = (s: DemoState) => s.tasks.filter((t) => t.actualCost > 0);
// Org-wide spend: modeled capability aggregates plus every sampled task in the store.
export const totalSpend = (s: DemoState) => sum(capabilityRows(s).map((c) => c.spent));
const completed = (s: DemoState) => s.tasks.filter((t) => t.status === 'completed');

export function budgetVsActual(s: DemoState) {
  const rows = capabilityRows(s);
  const inits = [...new Map(rows.map((r) => [r.initiative, r.team])).entries()];
  return inits.map(([initiative, team]) => {
    const r = rows.filter((x) => x.initiative === initiative);
    const budget = sum(r.map((x) => x.budget));
    const actual = sum(r.map((x) => x.spent));
    return { team, initiative, budget, actual, variance: actual - budget };
  });
}

export function byTeam(s: DemoState) {
  const rows = budgetVsActual(s);
  return [...new Set(rows.map((r) => r.team))].map((team) => {
    const r = rows.filter((x) => x.team === team);
    return { team, budget: sum(r.map((x) => x.budget)), actual: sum(r.map((x) => x.actual)) };
  });
}

export interface OffPlanRun {
  task: Task;
  overBy: number;
  state: 'needs decision' | 'needs review' | 'resolved';
  note: string;
}

export function offPlanRuns(s: DemoState): OffPlanRun[] {
  const out: OffPlanRun[] = [];
  for (const t of s.tasks) {
    const overBy = t.actualCost - t.quote.high;
    if (t.status === 'paused') {
      out.push({ task: t, overBy, state: 'needs decision', note: s.heroEscalated ? 'Paused at its ceiling; the engineer escalated it. Decision below.' : 'Paused at its ceiling; the engineer is deciding.' });
    } else if (t.status === 'completed' && (overBy > OFF_PLAN_MIN_OVER || t.delivered === false)) {
      const ratio = t.actualCost / t.quote.high;
      const note = t.delivered === false ? 'Stopped and reverted; capability not delivered.'
        : t.justified === 'yes' ? `Ran ${ratio.toFixed(1)}x the quote ceiling; reviewed and tagged justified.`
          : t.justified === 'no' ? `Ran ${ratio.toFixed(1)}x the quote ceiling; tagged not justified.`
            : `Ran ${ratio.toFixed(1)}x the quote ceiling; not yet reviewed.`;
      out.push({ task: t, overBy, state: t.justified === 'unset' && t.delivered !== false ? 'needs review' : 'resolved', note });
    }
  }
  return out.sort((a, b) => b.overBy - a.overBy);
}

// E1-style coverage on the September window, quoting from tasks completed before it.
export function quoteAccuracy(s: DemoState) {
  const hist = completed(s).filter((t) => !t.role);
  const train = hist.filter((t) => t.date < TEST_START);
  const test = hist.filter((t) => t.date >= TEST_START);
  const hits = test.map((t) => {
    const q = estimate({ type: t.type, size: t.size, repoArea: t.repoArea, team: t.team, developer: t.developer }, train).quote;
    return t.actualCost >= q.low && t.actualCost <= q.high ? 1 : 0;
  });
  return { coverage: mean(hits), n: test.length };
}

const approved = (t: Task) => t.quote.high <= AUTO_APPROVE_LIMIT || t.role !== undefined;

export function scorecard(s: DemoState) {
  const runs = spendTasks(s);
  const spend = sum(runs.map((t) => t.actualCost));
  const controlledSpend = sum(runs.filter(approved).map((t) => Math.min(t.actualCost, t.quote.high)));
  const done = completed(s);
  const tagged = done.filter((t) => t.justified !== 'unset');
  return {
    controlByTask: runs.filter(approved).length / runs.length,
    controlByDollars: controlledSpend / spend,
    justified: tagged.length ? tagged.filter((t) => t.justified === 'yes').length / tagged.length : NaN,
    tagCoverage: tagged.length / done.length,
    taggedCount: tagged.length,
    completedCount: done.length,
    quoteAccuracy: quoteAccuracy(s).coverage,
    runs: runs.length,
  };
}

export interface Guardrail {
  title: string;
  evidence: string;
  recommendation: string;
}

export function guardrails(s: DemoState): Guardrail[] {
  const hist = completed(s).filter((t) => !t.role && !(t.quote.low === 2 && t.quote.high === 40));
  const inside = (t: Task) => t.actualCost >= t.quote.low && t.actualCost <= t.quote.high;
  const overall = mean(hist.map((t) => (inside(t) ? 1 : 0)));
  const areas = [...new Set(hist.map((t) => t.repoArea))]
    .map((a) => {
      const ts = hist.filter((t) => t.repoArea === a);
      return { area: a, n: ts.length, cov: mean(ts.map((t) => (inside(t) ? 1 : 0))), p75: median(ts.map((t) => t.actualCost).sort((x, y) => x - y).slice(Math.floor(ts.length / 2))) };
    })
    .filter((a) => a.n >= 8)
    .sort((a, b) => a.cov - b.cov);
  const weak = areas[0];

  const capped = spendTasks(s).filter((t) => t.status === 'completed' && t.actualCost > IN_FLIGHT_CAP_MULT * t.quote.high);
  const overCap = sum(capped.map((t) => t.actualCost - IN_FLIGHT_CAP_MULT * t.quote.high));
  const autoShare = mean(spendTasks(s).map((t) => (t.quote.high <= AUTO_APPROVE_LIMIT ? 1 : 0)));

  return [
    {
      title: `Estimates are weakest in ${weak.area}`,
      evidence: `${Math.round(weak.cov * 100)}% of ${weak.n} ${weak.area} runs landed inside their quote, vs ${Math.round(overall * 100)}% across all areas.`,
      recommendation: `Require a plan review before ${weak.area} runs whose quote ceiling exceeds $${weak.p75.toFixed(0)} (the 75th-percentile cost there) until coverage recovers.`,
    },
    {
      title: `Add an in-flight cap at ${IN_FLIGHT_CAP_MULT}x the quote ceiling`,
      evidence: `${Math.round(autoShare * 100)}% of runs auto-approve under the $${AUTO_APPROVE_LIMIT} threshold, which is working. But ${capped.length} completed runs went past ${IN_FLIGHT_CAP_MULT}x their ceiling, spending $${overCap.toFixed(0)} beyond that point.`,
      recommendation: `Keep the $${AUTO_APPROVE_LIMIT} auto-approve threshold and pause runs at ${IN_FLIGHT_CAP_MULT}x their ceiling for an engineer decision. That puts up to $${overCap.toFixed(0)} behind a checkpoint.`,
    },
  ];
}

// ---- CFO ----

export type CapStatus = 'delivered' | 'in progress' | 'stopped';

export interface CapabilityRow {
  capability: string;
  initiative: string;
  team: string;
  budget: number;
  spent: number;
  runs: number;
  status: CapStatus;
  over: number; // spent - budget
  aggregate: CapabilityAggregate;
  sampled: Task[];
}

export function capabilityRows(s: DemoState): CapabilityRow[] {
  return s.capabilities.map((agg) => {
    const sampled = s.tasks.filter((t) => t.capability === agg.capability);
    const spent = agg.modeledSpend + sum(sampled.map((t) => t.actualCost));
    const status: CapStatus = sampled.some((t) => t.delivered === false) ? 'stopped'
      : sampled.some((t) => t.status !== 'completed') ? 'in progress' : agg.plannedStatus;
    return { capability: agg.capability, initiative: agg.initiative, team: agg.team, budget: agg.budget, spent, runs: agg.modeledRuns + sampled.length, status, over: spent - agg.budget, aggregate: agg, sampled };
  });
}

// Week index within the quarter for a sampled task's date.
function weekIndex(date: string, weeks: number): number {
  const day = Math.floor((Date.parse(date + 'T00:00:00Z') - Date.parse(QUARTER_START + 'T00:00:00Z')) / 86400000);
  return Math.min(weeks - 1, Math.max(0, Math.floor(day / 7)));
}
export const QUARTER_START = '2026-07-01';

export interface OrgWeek { start: string; spend: number; oneOff: number; paused: number }

export function orgWeekly(s: DemoState): OrgWeek[] {
  const n = s.capabilities[0]?.weekly.length ?? 0;
  const pausedCap = s.tasks.find((t) => t.role === 'hero')?.capability;
  const weeks: OrgWeek[] = Array.from({ length: n }, (_, i) => ({
    start: new Date(Date.parse(QUARTER_START + 'T00:00:00Z') + i * 7 * 86400000).toISOString().slice(0, 10), spend: 0, oneOff: 0, paused: 0,
  }));
  for (const c of s.capabilities) {
    c.weekly.forEach((v, i) => {
      weeks[i].spend += v;
      weeks[i].oneOff += c.oneOffWeekly[i];
      if (c.capability === pausedCap) weeks[i].paused += v;
    });
  }
  for (const t of s.tasks) {
    if (t.actualCost <= 0) continue;
    const i = weekIndex(t.date, n);
    weeks[i].spend += t.actualCost;
    if (t.capability === pausedCap) weeks[i].paused += t.actualCost;
  }
  return weeks;
}

// Remaining work on the paused capability, priced at its own spend per unit so far.
export function pausedScopeCost(s: DemoState) {
  const paused = s.tasks.find((t) => t.role === 'hero')!;
  const row = capabilityRows(s).find((c) => c.capability === paused.capability)!;
  const ctx = PAUSED_SCENARIO;
  const perUnit = row.spent / ctx.doneUnits;
  const byOption: Record<DecisionKey, number> = {
    continue: perUnit * (ctx.discoveredUnits - ctx.doneUnits),
    'planned-only': perUnit * (ctx.plannedUnits - ctx.doneUnits),
    stop: 0,
  };
  const decided = s.pausedDecision?.key;
  return { capability: paused.capability, byOption, decided, low: decided ? byOption[decided] : 0, high: decided ? byOption[decided] : byOption.continue };
}

export function nextQuarterForecast(s: DemoState) {
  const weeks = orgWeekly(s);
  // Ongoing work only: one-off spend and the paused capability are handled separately.
  const base = weeks.map((w) => ({ start: w.start, spend: w.spend - w.oneOff - w.paused }));
  const horizon = weeks.length;
  const f = forecast(base, horizon);
  const weekly = forecast(base, 1);
  const p = pausedScopeCost(s);
  return { low: f.low + p.low, high: f.high + p.high, horizon, weeklyLow: weekly.low + p.low / horizon, weeklyHigh: weekly.high + p.high / horizon, weeklyMid: weekly.mid + (p.low + p.high) / 2 / horizon };
}

export interface OverBudgetItem {
  row: CapabilityRow;
  inProgress: boolean;
  note: string | null;
  effect: string;
}

export function overBudgetItems(s: DemoState, money: (n: number) => string): OverBudgetItem[] {
  const p = pausedScopeCost(s);
  const ctx = PAUSED_SCENARIO;
  return capabilityRows(s).filter((r) => r.over > 0).sort((a, b) => b.over - a.over).map((row) => {
    const inProgress = row.status === 'in progress';
    if (row.capability === p.capability) {
      const key = p.decided ?? 'pending';
      const effect = !p.decided ? `Depends on the pending decision: adds between ${money(p.byOption.stop)} and ${money(p.byOption.continue)}.`
        : p.decided === 'continue' ? `Adds ${money(p.byOption.continue)} to finish the remaining ${ctx.discoveredUnits - ctx.doneUnits} services.`
          : p.decided === 'planned-only' ? `Adds ${money(p.byOption['planned-only'])} to finish the planned ${ctx.plannedUnits}; the rest will be budgeted separately.`
            : 'None. The work is stopped.';
      return { row, inProgress, note: `${ctx.note.cause} ${ctx.note[key]}`, effect };
    }
    const n = row.aggregate.note;
    const effect = !n ? `Unknown until engineering explains it. The range assumes it continues, about ${money(row.over)}.`
      : n.recurs === 'yes' ? `Included. The range assumes this continues, about ${money(row.over)}.`
        : 'None. A one-off, left out of the range.';
    return { row, inProgress, note: n?.text ?? null, effect };
  });
}

// Share of finished tasks whose cost stayed within the budget they started with.
export function finishedWithinBudget(s: DemoState) {
  const done = completed(s).filter((t) => t.delivered !== false);
  return mean(done.map((t) => (t.actualCost <= t.quote.high ? 1 : 0)));
}
