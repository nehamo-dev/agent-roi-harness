// E3: cross-view consistency. Replays UI actions through the same reducer and selectors the views use.
import { mkdirSync, writeFileSync } from 'node:fs';
import { decisionOptions } from '../src/core/decision';
import { estimate } from '../src/core/estimator';
import { reducer, heroTask, quoteHistory, type DemoState } from '../src/core/reducer';
import { budgetVsActual, capabilityRows, finishedWithinBudget, guardrails, nextQuarterForecast, offPlanRuns, orgWeekly, overBudgetItems, scorecard, totalSpend } from '../src/core/selectors';
import { q4Summary } from '../src/core/q4';
import { computeReceipt, type Choice } from '../src/core/session';
import { sum } from '../src/core/stats';
import { buildDataset } from '../src/data/dataset';
import { HERO_SCENARIO } from '../src/data/heroScenario';
import { PAUSED_SCENARIO } from '../src/data/pausedScenario';

const initial: DemoState = { ...buildDataset(), heroReceipt: null, pausedDecision: null };
const results: { check: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => results.push({ check: name, pass, detail });
const close = (a: number, b: number) => Math.abs(a - b) < 0.005;

function runHero(state: DemoState, choice: Choice): DemoState {
  const hero = heroTask(state);
  const q = estimate({ type: hero.type, size: hero.size, repoArea: hero.repoArea, team: hero.team, developer: hero.developer }, quoteHistory(state)).quote;
  return reducer(state, { kind: 'completeHero', receipt: computeReceipt(HERO_SCENARIO, q, choice, hero.capability, hero.prNumber) });
}
const leaderTotal = (s: DemoState) => sum(budgetVsActual(s).map((b) => b.actual));
const cfoTotal = (s: DemoState) => sum(capabilityRows(s).map((c) => c.spent));
// Independent recomputation straight from the store, and the CFO chart's weekly bars.
const storeTotal = (s: DemoState) => sum(s.capabilities.map((c) => c.modeledSpend)) + sum(s.tasks.map((t) => t.actualCost));
const chartTotal = (s: DemoState) => sum(orgWeekly(s).map((w) => w.spend));

// 1. Totals agree.
for (const [label, s] of [['initial', initial], ['after hero run', runHero(initial, 'platform')]] as const) {
  check(`Total spend identical in leader and CFO views (${label})`,
    close(leaderTotal(s), cfoTotal(s)) && close(leaderTotal(s), totalSpend(s)) && close(leaderTotal(s), storeTotal(s)) && close(leaderTotal(s), chartTotal(s)),
    `leader $${leaderTotal(s).toFixed(2)}, CFO $${cfoTotal(s).toFixed(2)}, CFO weekly chart $${chartTotal(s).toFixed(2)}, recomputed from store $${storeTotal(s).toFixed(2)}`);
}

// 2. Hero cost matches receipt, leader row, CFO entry.
const sP = runHero(initial, 'platform');
const heroP = heroTask(sP);
const rowP = capabilityRows(sP).find((c) => c.capability === heroP.capability)!;
const heroInRow = rowP.sampled.find((t) => t.id === heroP.id)?.actualCost ?? NaN;
const rowBefore = capabilityRows(initial).find((c) => c.capability === heroP.capability)!;
check('Hero cost matches across receipt, leader row and CFO entry', close(Math.round(sP.heroReceipt!.actual * 100) / 100, heroP.actualCost) && close(heroInRow, heroP.actualCost) && close(rowP.spent - rowBefore.spent, heroP.actualCost) && rowP.runs === rowBefore.runs,
  `receipt $${sP.heroReceipt!.actual.toFixed(2)}, leader task row $${heroP.actualCost.toFixed(2)}, CFO capability total rises by $${(rowP.spent - rowBefore.spent).toFixed(2)} (hero counted inside its capability's ${rowP.runs} runs)`);

// 3. Paused decision updates leader and CFO.
const paused = initial.tasks.find((t) => t.role === 'paused-decision')!;
const opt = decisionOptions(paused, PAUSED_SCENARIO)[1];
const sD = reducer(initial, { kind: 'resolvePaused', option: opt });
const offBefore = offPlanRuns(initial).find((o) => o.task.id === paused.id)?.state;
const offAfter = offPlanRuns(sD).find((o) => o.task.id === paused.id)?.state ?? 'not surfaced';
const noteOf = (s: DemoState) => overBudgetItems(s, (n) => n.toFixed(0)).find((o) => o.row.capability === paused.capability);
const fcA = nextQuarterForecast(initial);
const fcB = nextQuarterForecast(sD);
check('Paused-run decision updates leader view and CFO totals',
  offBefore === 'needs decision' && offAfter !== 'needs decision' && close(cfoTotal(sD) - cfoTotal(initial), opt.addedCost) && close(leaderTotal(sD) - leaderTotal(initial), opt.addedCost)
    && noteOf(initial)?.note !== noteOf(sD)?.note && (fcA.low !== fcB.low || fcA.high !== fcB.high),
  `T-149 ${offBefore} -> ${offAfter}; leader and CFO totals both +$${opt.addedCost.toFixed(2)}; CFO owner's note and forecast range change ($${fcA.low.toFixed(0)}-$${fcA.high.toFixed(0)} -> $${fcB.low.toFixed(0)}-$${fcB.high.toFixed(0)})`);

// 4. Tagging updates scorecard.
const untagged = initial.tasks.find((t) => t.status === 'completed' && t.justified === 'unset')!;
const scA = scorecard(initial);
const scB = scorecard(reducer(initial, { kind: 'tag', taskId: untagged.id, justified: 'no' }));
check('Tagging updates the scorecard', scB.taggedCount === scA.taggedCount + 1 && scB.justified < scA.justified && scB.tagCoverage > scA.tagCoverage,
  `justified ${(scA.justified * 100).toFixed(1)}% -> ${(scB.justified * 100).toFixed(1)}%, coverage ${(scA.tagCoverage * 100).toFixed(1)}% -> ${(scB.tagCoverage * 100).toFixed(1)}%`);

// 5. Trade-off choice changes receipt and downstream numbers.
const sS = runHero(initial, 'surface');
const rowS = capabilityRows(sS).find((c) => c.capability === heroP.capability)!;
check('Different trade-off changes receipt and downstream numbers', !close(sS.heroReceipt!.actual, sP.heroReceipt!.actual) && !close(rowS.spent, rowP.spent) && !close(totalSpend(sS), totalSpend(sP)),
  `surface receipt $${sS.heroReceipt!.actual.toFixed(2)} vs platform $${sP.heroReceipt!.actual.toFixed(2)}; CFO row $${rowS.spent.toFixed(2)} vs $${rowP.spent.toFixed(2)}`);

// 5b. Q4 view: Q3 figure matches the leader, department totals add up, and the paused decision reaches Q4.
{
  const m = (n: number) => n.toFixed(0);
  const qa = q4Summary(initial, m);
  const qb = q4Summary(sD, m);
  const engA = qa.depts.find((d) => d.engineering)!;
  const platA = engA.teams.find((t) => t.note.startsWith('Wider range'));
  const platB = qb.depts.find((d) => d.engineering)!.teams.find((t) => t.team === platA?.team);
  check('Q4 view agrees with Q3 and the paused decision',
    close(engA.priorQuarter, leaderTotal(initial)) && close(qa.all.soFar, sum(qa.depts.map((d) => d.soFar))) && !!platA && !!platB && platB.note !== platA.note && platB.high < platA.high,
    `Engineering "Q3 actual" $${engA.priorQuarter.toFixed(2)} = leader total; all-department so far $${qa.all.soFar.toFixed(0)} = sum of departments; Platform Q4 forecast high $${platA?.high.toFixed(0)} -> $${platB?.high.toFixed(0)} after the decision`);
}

// 6. No NaN, negative or empty values in view-level outputs.
const bad: string[] = [];
function walk(v: unknown, path: string) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) bad.push(`${path}=NaN`);
    else if (v < 0 && !/variance|overBy|\.over\b|oneOff/.test(path)) bad.push(`${path}=${v}`);
  } else if (typeof v === 'string') { if (v.trim() === '' && !/eventLogId/.test(path)) bad.push(`${path} empty`); }
  else if (Array.isArray(v)) { if (v.length === 0 && !/similar/.test(path)) bad.push(`${path} empty array`); v.forEach((x, i) => walk(x, `${path}[${i}]`)); }
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
}
for (const [label, s] of [['initial', initial], ['all actions', reducer(runHero(sD, 'platform'), { kind: 'tag', taskId: untagged.id, justified: 'yes' })]] as const) {
  walk({ sc: scorecard(s), bva: budgetVsActual(s), off: offPlanRuns(s).map((o) => ({ overBy: o.overBy, note: o.note })), caps: capabilityRows(s).map(({ sampled, aggregate, ...r }) => r), weeks: orgWeekly(s), fc: nextQuarterForecast(s), within: finishedWithinBudget(s), overItems: overBudgetItems(s, (n) => n.toFixed(0)).map((o) => ({ effect: o.effect, over: o.row.over })), rails: guardrails(s), q4: q4Summary(s, (n) => n.toFixed(0)).depts.map(({ teams, ...d }) => ({ ...d, teams: teams.map(({ note, ...t }) => t) })) }, label);
}
check('No NaN, negative or empty values (variances excepted)', bad.length === 0, bad.length ? bad.slice(0, 5).join('; ') : 'scorecard, budgets, off-plan, capabilities, reliability, guardrails, forecast all clean');

const allPass = results.every((r) => r.pass);
const out = [
  '# E3 cross-view consistency',
  '',
  '> SYNTHETIC DATA. Replays UI actions through the shared reducer and the selectors every view renders from.',
  '',
  '| Check | Status | Detail |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.check} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail} |`),
  '',
  `Overall: ${allPass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.pass).length}/${results.length})`,
].join('\n') + '\n';
console.log(out);
mkdirSync('eval-results', { recursive: true });
writeFileSync('eval-results/e3-consistency.md', out);
console.log('Saved eval-results/e3-consistency.md');
process.exitCode = allPass ? 0 : 1;
