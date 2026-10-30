import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { decisionOptions } from '../core/decision';
import { budgetVsActual, byTeam, guardrails, OFF_PLAN_MIN_OVER, offPlanRuns, scorecard, totalSpend } from '../core/selectors';
import { PAUSED_SCENARIO } from '../data/pausedScenario';
import { useStore } from '../state/store';
import { money, tok, usd } from './fmt';
import { USD_PER_MILLION_TOKENS } from '../core/tokens';
import { TaskLink } from './TaskDetail';
import { followUp, heroTask } from '../core/reducer';
import { ILLUSTRATIVE } from '../data/illustrative';

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

export function LeaderView() {
  const { state, dispatch } = useStore();
  const sc = scorecard(state);
  const teams = byTeam(state);
  const inits = budgetVsActual(state);
  const offPlan = offPlanRuns(state);
  const rails = guardrails(state);
  const paused = heroTask(state);
  const options = decisionOptions({ ...paused, actualCost: state.pausedDecision ? paused.actualCost - state.pausedDecision.addedCost : paused.actualCost }, PAUSED_SCENARIO);
  const split = followUp(state);

  return (
    <>
      <section className="card">
        <h3>Engineering leader: AI coding budget, Q3 2026 <span className="pill warn">synthetic data</span></h3>
        <p className="muted">Total spend {money(totalSpend(state))} ({tok(totalSpend(state))} at ${USD_PER_MILLION_TOKENS} per million) this quarter across the org (modeled). Pilot scorecard from {sc.runs} sampled runs, computed live from the shared store:</p>
        <div className="tiles">
          <div className="tile"><div className="tile-v">{pct(sc.controlByTask)}</div><div className="tile-l">Control by task: runs started under an approved quote</div></div>
          <div className="tile"><div className="tile-v">{pct(sc.controlByDollars)}</div><div className="tile-l">Control by dollars: spend that ran inside an approved quote</div></div>
          <div className="tile"><div className="tile-v">{pct(sc.justified)}</div><div className="tile-l">Justified (of tagged) · tag coverage {pct(sc.tagCoverage)} ({sc.taggedCount}/{sc.completedCount})</div></div>
          <div className="tile"><div className="tile-v">{pct(ILLUSTRATIVE.quoteAccuracy)}</div><div className="tile-l">Quote accuracy: runs that landed inside their quote</div></div>
        </div>
      </section>

      <section className="card">
        <h3>Budget vs actual</h3>
        <div className="two-col">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={inits} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="initiative" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#b8c4dc" />
                <Bar dataKey="actual" name="Actual" fill="#2f5bd3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead><tr><th>Team / initiative</th><th className="num">Budget</th><th className="num">Actual</th><th className="num">Variance</th></tr></thead>
            <tbody>{teams.map((tm) => [
              <tr key={tm.team} className="team-row"><td>{tm.team}</td><td className="num">{money(tm.budget)}</td><td className="num">{money(tm.actual)} <span className="muted">· {tok(tm.actual)}</span></td><td className={`num ${tm.actual > tm.budget ? 'bad' : 'ok'}`}>{money(tm.actual - tm.budget)}</td></tr>,
              ...inits.filter((i) => i.team === tm.team).map((i) => (
                <tr key={i.initiative}><td className="indent">{i.initiative}</td><td className="num">{money(i.budget)}</td><td className="num">{money(i.actual)} <span className="muted">· {tok(i.actual)}</span></td><td className={`num ${i.variance > 0 ? 'bad' : 'ok'}`}>{money(i.variance)}</td></tr>
              )),
            ])}</tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Needs a decision: <TaskLink id={paused.id} />, {paused.capability}</h3>
        <p className="muted">{paused.team} · {paused.developer} · {paused.type} {paused.size} in {paused.repoArea} · quote {usd(paused.quote.low)} – {usd(paused.quote.high)}</p>
        {state.pausedDecision ? (
          <p><span className="pill ok">resolved</span> {state.decidedBy === 'engineer' ? `${paused.developer} chose` : 'You chose'} <b>{state.pausedDecision.label}</b>. Final cost {usd(paused.actualCost)} ({tok(paused.actualCost)}){state.pausedDecision.delivered ? '' : '; capability not delivered'}{split ? <>; the rest moved to <TaskLink id={split.id} /></> : null}. Every view now reflects this.</p>
        ) : paused.status === 'running' ? (
          <p className="muted">{paused.developer} is still running this in the engineer view. Play it there: if it needs a decision above their approval limit, it lands here.</p>
        ) : !state.heroEscalated ? (
          <p className="muted">Paused at {usd(paused.actualCost)} ({tok(paused.actualCost)}). {paused.developer} is choosing in the engineer view; options above their approval limit come here.</p>
        ) : (
          <>
            <p><b>Why it stopped:</b> {PAUSED_SCENARIO.why} Spent {usd(paused.actualCost)} ({tok(paused.actualCost)}) against a ceiling of {usd(paused.quote.high)} ({tok(paused.quote.high)}).</p>
            <p><b>What changed:</b> {PAUSED_SCENARIO.changed} {PAUSED_SCENARIO.doneUnits} of {PAUSED_SCENARIO.discoveredUnits} {PAUSED_SCENARIO.unitLabel} done, at about {usd(paused.actualCost / PAUSED_SCENARIO.runDoneUnits)} ({tok(paused.actualCost / PAUSED_SCENARIO.runDoneUnits)}) each. {paused.developer} asked to do all {PAUSED_SCENARIO.discoveredUnits}, which is above their approval limit.</p>
            <div className="options">{options.map((o) => (
              <button key={o.key} className="option" onClick={() => dispatch({ kind: 'resolvePaused', option: o, by: 'leader' })}>
                <b>{o.label}</b><span className="opt-cost">+{usd(o.addedCost)} → total {usd(o.finalCost)}</span><span className="muted">+{tok(o.addedCost)} → total {tok(o.finalCost)}</span><span className="muted">{o.detail}</span>
              </button>
            ))}</div>
          </>
        )}
      </section>

      <section className="card">
        <h3>Off-plan runs only ({offPlan.length} of {sc.runs})</h3>
        <p className="muted">Runs more than {usd(OFF_PLAN_MIN_OVER)} over their quote ceiling, paused, or stopped. Everything else ran inside plan.</p>
        <table>
          <thead><tr><th>Task</th><th>Team</th><th>Capability</th><th className="num">Quote</th><th className="num">Actual</th><th>State</th><th>What was done / needed</th></tr></thead>
          <tbody>{offPlan.map((o) => (
            <tr key={o.task.id}><td><TaskLink id={o.task.id} /></td><td>{o.task.team}</td><td>{o.task.capability}</td>
              <td className="num">{usd(o.task.quote.low)} – {usd(o.task.quote.high)}</td><td className="num">{usd(o.task.actualCost)} <span className="muted">· {tok(o.task.actualCost)}</span></td>
              <td><span className={`pill ${o.state === 'resolved' ? 'ok' : 'warn'}`}>{o.state}</span></td><td>{o.note}</td></tr>
          ))}</tbody>
        </table>
      </section>

      <section className="card">
        <h3>Guardrail recommendations</h3>
        <div className="two-col">{rails.map((g) => (
          <div key={g.title} className="rail"><b>{g.title}</b><p>{g.evidence}</p><p className="rec">→ {g.recommendation}</p></div>
        ))}</div>
      </section>

    </>
  );
}
