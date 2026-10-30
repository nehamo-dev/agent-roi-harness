// Q4-so-far figures for the CFO view: per department and team, actual so far, full-quarter forecast range,
// budget status, and how often past weekly forecasts held. Pure functions over the shared state.
import type { Department, Q4Team } from '../data/q4';
import { forecast, type Week } from './forecast';
import type { DemoState } from './reducer';
import { capabilityRows, pausedScopeCost, totalSpend } from './selectors';
import { sum } from './stats';
import { ILLUSTRATIVE } from '../data/illustrative';

export type DeptStatus = 'ok' | 'watch' | 'over';
export const ACCURACY_WEEKS = 12;

const elapsedDays = (s: DemoState) => Math.round((Date.parse(s.q4.asOf + 'T00:00:00Z') - Date.parse(s.q4.start + 'T00:00:00Z')) / 86400000) + 1;
// Completed Q4 weeks only; a trailing partial week is left out of forecast inputs.
const fullWeeks = (t: Q4Team, elapsed: number) => t.q4Weekly.slice(0, Math.floor(elapsed / 7));
const asWeeks = (xs: number[]): Week[] => xs.map((spend, i) => ({ start: String(i), spend }));

function teamNote(s: DemoState, t: Q4Team, money: (n: number) => string): string {
  const n = t.note;
  if (n.kind === 'text') return n.text;
  if (n.kind === 'recurring') {
    const row = capabilityRows(s).find((r) => r.capability === n.capability);
    return n.text.replace('{amount}', money(Math.max(0, row?.over ?? 0)));
  }
  const p = pausedScopeCost(s);
  if (!p.decided) return `Wider range: one open scope question could add up to ${money(p.byOption.continue)}.`;
  if (p.decided === 'stop') return 'The open scope question is settled: the work stopped, so nothing is added.';
  return `Includes ${money(p.byOption[p.decided])} for the scope leadership approved on ${p.capability}.`;
}

export function q4Summary(s: DemoState, money: (n: number) => string) {
  const elapsed = elapsedDays(s);
  const horizon = Math.round((s.q4.days - elapsed) / 7);
  const p = pausedScopeCost(s);

  const depts = s.q4.departments.map((d: Department) => {
    // Engineering's to-date spend and plan are set for the demo (same as the leader tile); teams scale to match.
    const raw = sum(d.teams.map((t) => sum(t.q4Weekly)));
    const target = d.engineering ? ILLUSTRATIVE.spendToDate : null;
    const spendScale = target ? target.spent / raw : 1;
    const budgetScale = target ? target.planned / d.budget : 1;
    const teams = d.teams.map((t) => {
      const soFar = sum(t.q4Weekly) * spendScale;
      const f = forecast(asWeeks([...t.priorWeekly, ...fullWeeks(t, elapsed)]), horizon);
      const open = t.note.kind === 'open-decision';
      const extraLow = open ? p.low : 0;
      const extraHigh = open ? p.high : 0;
      return { team: t.team, budget: t.budget * budgetScale, soFar, low: soFar + f.low + extraLow, high: soFar + f.high + extraHigh, note: teamNote(s, t, money) };
    });
    const budget = d.budget * budgetScale;
    const soFar = sum(teams.map((t) => t.soFar));
    const low = sum(teams.map((t) => t.low));
    const high = sum(teams.map((t) => t.high));
    const teamOver = teams.some((t) => t.budget > 0 && t.high > t.budget);
    const computedStatus: DeptStatus = low > budget ? 'over' : high > budget || teamOver ? 'watch' : 'ok';
    const status: DeptStatus = d.engineering ? ILLUSTRATIVE.engineeringStatus : computedStatus;

    // Rolling check: forecast each recent week from the weeks before it, count how many landed inside.
    const series = d.teams[0].priorWeekly.map((_, i) => sum(d.teams.map((t) => t.priorWeekly[i])))
      .concat(fullWeeks(d.teams[0], elapsed).map((_, i) => sum(d.teams.map((t) => t.q4Weekly[i]))));
    const checks = series.map((actual, k) => ({ actual, k })).slice(-ACCURACY_WEEKS).map(({ actual, k }) => {
      const fk = forecast(asWeeks(series.slice(0, k)), 1);
      return actual >= fk.low && actual <= fk.high;
    });
    const priorQuarter = d.engineering ? totalSpend(s) : sum(d.teams.map((t) => sum(t.priorWeekly)));
    return { name: d.name, engineering: d.engineering, budget, soFar, low, high, status, teams, priorQuarter, computedStatus, accuracy: d.engineering ? ILLUSTRATIVE.engineeringForecastAccuracy : { inside: checks.filter(Boolean).length, weeks: checks.length }, computedAccuracy: { inside: checks.filter(Boolean).length, weeks: checks.length } };
  });

  const all = { soFar: sum(depts.map((d) => d.soFar)), low: sum(depts.map((d) => d.low)), high: sum(depts.map((d) => d.high)) };
  const eng = depts.find((d) => d.engineering)!;
  return { asOf: s.q4.asOf, elapsed, days: s.q4.days, depts, all, engShare: eng.soFar / all.soFar };
}
