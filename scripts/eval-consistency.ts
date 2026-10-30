// E3: cross-view consistency. Replays UI actions through the same reducer and selectors the views use.
import { mkdirSync, writeFileSync } from 'node:fs';
import { decisionOptions } from '../src/core/decision';
import { q4Summary } from '../src/core/q4';
import { followUp, heroTask, reducer, type DemoState } from '../src/core/reducer';
import { budgetVsActual, capabilityRows, finishedWithinBudget, guardrails, nextQuarterForecast, offPlanRuns, orgWeekly, overBudgetItems, scorecard, totalSpend } from '../src/core/selectors';
import { AUTO_APPROVE_LIMIT, HERO_QUOTE_MAX_WIDTH, runSteps } from '../src/core/session';
import { sum } from '../src/core/stats';
import { buildDataset } from '../src/data/dataset';
import { HERO_SCENARIO } from '../src/data/heroScenario';
import { PAUSED_SCENARIO } from '../src/data/pausedScenario';

const initial: DemoState = { ...buildDataset(), pausedDecision: null, decidedBy: null, heroEscalated: false };
const results: { check: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => results.push({ check: name, pass, detail });
const close = (a: number, b: number) => Math.abs(a - b) < 0.005;

const leaderTotal = (s: DemoState) => sum(budgetVsActual(s).map((b) => b.actual));
const cfoTotal = (s: DemoState) => sum(capabilityRows(s).map((c) => c.spent));
const storeTotal = (s: DemoState) => sum(s.capabilities.map((c) => c.modeledSpend)) + sum(s.tasks.map((t) => t.actualCost));
const chartTotal = (s: DemoState) => sum(orgWeekly(s).map((w) => w.spend));

// Replay the engineer view: play to the decision step, then choose.
const pausedCost = runSteps(HERO_SCENARIO).at(-1)!.spentAfter;
const sPaused = reducer(initial, { kind: 'heroPaused', cost: pausedCost });
const hero0 = heroTask(sPaused);
const opts = decisionOptions(hero0, PAUSED_SCENARIO);
const opt = (k: string) => opts.find((o) => o.key === k)!;
const sSix = reducer(sPaused, { kind: 'resolvePaused', option: opt('planned-only'), by: 'engineer' });
const sStop = reducer(sPaused, { kind: 'resolvePaused', option: opt('stop'), by: 'engineer' });
const sEsc = reducer(sPaused, { kind: 'escalate' });
const sAll = reducer(sEsc, { kind: 'resolvePaused', option: opt('continue'), by: 'leader' });

// 1. Totals agree.
for (const [label, s] of [['initial', initial], ['hero paused', sPaused], ['engineer finished 6', sSix], ['leader approved all', sAll]] as const) {
  check(`Total spend identical in leader and CFO views (${label})`,
    close(leaderTotal(s), cfoTotal(s)) && close(leaderTotal(s), totalSpend(s)) && close(leaderTotal(s), storeTotal(s)) && close(leaderTotal(s), chartTotal(s)),
    `leader $${leaderTotal(s).toFixed(2)}, CFO $${cfoTotal(s).toFixed(2)}, CFO weekly chart $${chartTotal(s).toFixed(2)}, recomputed $${storeTotal(s).toFixed(2)}`);
}

// 2. Hero quote is the committed band.
const q = heroTask(initial).quote;
check('Hero quote: ceiling is the top, high no more than 1.3x low', q.high / q.low <= HERO_QUOTE_MAX_WIDTH + 1e-6 && q.high > q.low,
  `T-149 quote $${q.low.toFixed(2)}-$${q.high.toFixed(2)} (${(q.high / q.low).toFixed(2)}x)`);

// 3. Hero cost matches across engineer, leader and CFO.
const heroSix = heroTask(sSix);
const rowInit = capabilityRows(initial).find((c) => c.capability === heroSix.capability)!;
const rowSix = capabilityRows(sSix).find((c) => c.capability === heroSix.capability)!;
check('Hero cost matches across engineer receipt, leader row and CFO entry',
  close(heroTask(sPaused).actualCost, Math.round(pausedCost * 100) / 100) && close(heroSix.actualCost, Math.round(opt('planned-only').finalCost * 100) / 100)
    && close(rowSix.spent - rowInit.spent, heroSix.actualCost) && rowSix.sampled.some((t) => t.id === heroSix.id),
  `paused at $${pausedCost.toFixed(2)}; receipt $${opt('planned-only').finalCost.toFixed(2)} = leader task $${heroSix.actualCost.toFixed(2)}; CFO capability rises by $${(rowSix.spent - rowInit.spent).toFixed(2)}`);

// 4. Escalation: only the option above the limit goes to the leader, and the leader's choice lands everywhere.
const offEsc = offPlanRuns(sEsc).find((o) => o.task.id === hero0.id);
check('"Do all 14" escalates; the leader decides it',
  opt('continue').addedCost > AUTO_APPROVE_LIMIT && opt('planned-only').addedCost <= AUTO_APPROVE_LIMIT && opt('stop').addedCost <= AUTO_APPROVE_LIMIT
    && heroTask(sEsc).status === 'paused' && sEsc.heroEscalated && offEsc?.state === 'needs decision'
    && sAll.decidedBy === 'leader' && close(leaderTotal(sAll) - leaderTotal(sPaused), opt('continue').addedCost),
  `continue +$${opt('continue').addedCost.toFixed(2)} > $${AUTO_APPROVE_LIMIT} limit; T-149 stays paused and shows "needs decision"; leader approval moves totals by +$${opt('continue').addedCost.toFixed(2)}`);

// 5. The engineer's two choices produce different receipts and downstream numbers.
const split = followUp(sSix);
check('Engineer choices change the receipt and downstream numbers',
  !close(heroTask(sSix).actualCost, heroTask(sStop).actualCost) && !close(totalSpend(sSix), totalSpend(sStop))
    && !!split && split.quote.high > 0 && !followUp(sStop) && heroTask(sStop).delivered === false
    && capabilityRows(sStop).find((c) => c.capability === heroSix.capability)!.status === 'stopped',
  `finish 6: $${heroTask(sSix).actualCost.toFixed(2)} and new task ${split?.id} quoted $${split?.quote.low.toFixed(2)}-$${split?.quote.high.toFixed(2)}; stop: $${heroTask(sStop).actualCost.toFixed(2)}, not delivered`);

// 6. Tagging updates the scorecard.
const untagged = initial.tasks.find((t) => t.status === 'completed' && t.justified === 'unset')!;
const scA = scorecard(initial);
const scB = scorecard(reducer(initial, { kind: 'tag', taskId: untagged.id, justified: 'no' }));
check('Tagging updates the scorecard', scB.taggedCount === scA.taggedCount + 1 && scB.justified < scA.justified && scB.tagCoverage > scA.tagCoverage,
  `justified ${(scA.justified * 100).toFixed(1)}% -> ${(scB.justified * 100).toFixed(1)}%, coverage ${(scA.tagCoverage * 100).toFixed(1)}% -> ${(scB.tagCoverage * 100).toFixed(1)}%`);

// 7. The decision reaches the CFO's Q3 note, forecast, and Q4 view.
{
  const m = (n: number) => n.toFixed(0);
  const noteOf = (s: DemoState) => overBudgetItems(s, m).find((o) => o.row.capability === heroSix.capability)?.note;
  const qa = q4Summary(sPaused, m);
  const qb = q4Summary(sSix, m);
  const engA = qa.depts.find((d) => d.engineering)!;
  const platA = engA.teams.find((t) => t.note.startsWith('Wider range'));
  const platB = qb.depts.find((d) => d.engineering)!.teams.find((t) => t.team === platA?.team);
  const fcA = nextQuarterForecast(sPaused);
  const fcB = nextQuarterForecast(sSix);
  check('Decision reaches the CFO view (Q3 note, forecast, Q4 Platform)',
    noteOf(sPaused) !== noteOf(sSix) && fcB.high < fcA.high && close(engA.priorQuarter, leaderTotal(sPaused))
      && close(qa.all.soFar, sum(qa.depts.map((d) => d.soFar))) && !!platA && !!platB && platB.note !== platA.note && platB.high < platA.high,
    `Q3 forecast high $${fcA.high.toFixed(0)} -> $${fcB.high.toFixed(0)}; Q4 Platform high $${platA?.high.toFixed(0)} -> $${platB?.high.toFixed(0)}; Engineering "Q3 actual" = leader total`);
}

// 8. No NaN, negative or empty values.
const bad: string[] = [];
function walk(v: unknown, path: string) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) bad.push(`${path}=NaN`);
    else if (v < 0 && !/variance|overBy|\.over\b|oneOff/.test(path)) bad.push(`${path}=${v}`);
  } else if (typeof v === 'string') { if (v.trim() === '' && !/eventLogId/.test(path)) bad.push(`${path} empty`); }
  else if (Array.isArray(v)) { if (v.length === 0 && !/similar/.test(path)) bad.push(`${path} empty array`); v.forEach((x, i) => walk(x, `${path}[${i}]`)); }
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
}
for (const [label, s] of [['initial', initial], ['paused', sPaused], ['finished 6', sSix], ['stopped', sStop], ['leader approved all', sAll]] as const) {
  walk({ sc: scorecard(s), bva: budgetVsActual(s), off: offPlanRuns(s).map((o) => ({ overBy: o.overBy, note: o.note })), caps: capabilityRows(s).map(({ sampled, aggregate, ...r }) => r), weeks: orgWeekly(s), fc: nextQuarterForecast(s), within: finishedWithinBudget(s), overItems: overBudgetItems(s, (n) => n.toFixed(0)).map((o) => ({ effect: o.effect, over: o.row.over })), rails: guardrails(s), q4: q4Summary(s, (n) => n.toFixed(0)).depts.map(({ teams, ...d }) => ({ ...d, teams: teams.map(({ note, ...t }) => t) })) }, label);
}
check('No NaN, negative or empty values (variances excepted)', bad.length === 0, bad.length ? bad.slice(0, 5).join('; ') : 'all view-level outputs clean across five states');

const allPass = results.every((r) => r.pass);
const out = [
  '# E3 cross-view consistency',
  '',
  '> SYNTHETIC DATA. Replays UI actions (engineer plays T-149, then chooses; leader decides escalations) through the shared reducer and the selectors every view renders from.',
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
