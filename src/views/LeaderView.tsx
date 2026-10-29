import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { decisionOptions } from '../core/decision';
import { heroTask } from '../core/reducer';
import { budgetVsActual, byTeam, guardrails, OFF_PLAN_MIN_OVER, offPlanRuns, scorecard, totalSpend } from '../core/selectors';
import { PAUSED_SCENARIO } from '../data/pausedScenario';
import { useStore } from '../state/store';
import { money, usd } from './fmt';

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

export function LeaderView() {
  const { state, dispatch } = useStore();
  const sc = scorecard(state);
  const teams = byTeam(state);
  const inits = budgetVsActual(state);
  const offPlan = offPlanRuns(state);
  const rails = guardrails(state);
  const hero = heroTask(state);
  const paused = state.tasks.find((t) => t.role === 'paused-decision')!;
  const options = decisionOptions({ ...paused, actualCost: state.pausedDecision ? paused.actualCost - state.pausedDecision.addedCost : paused.actualCost }, PAUSED_SCENARIO);
  const queue = state.tasks.filter((t) => t.status === 'completed' && t.justified === 'unset').sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <section className="card">
        <h3>Engineering leader: AI coding budget, Q3 2026 <span className="pill warn">synthetic data</span></h3>
        <p className="muted">Total spend {money(totalSpend(state))} this quarter across the org (modeled). Pilot scorecard from {sc.runs} sampled runs, computed live from the shared store:</p>
        <div className="tiles">
          <div className="tile"><div className="tile-v">{pct(sc.controlByTask)}</div><div className="tile-l">Control by task: runs started under an approved quote</div></div>
          <div className="tile"><div className="tile-v">{pct(sc.controlByDollars)}</div><div className="tile-l">Control by dollars: spend that ran inside an approved quote</div></div>
          <div className="tile"><div className="tile-v">{pct(sc.justified)}</div><div className="tile-l">Justified (of tagged) · tag coverage {pct(sc.tagCoverage)} ({sc.taggedCount}/{sc.completedCount})</div></div>
          <div className="tile"><div className="tile-v">{pct(sc.quoteAccuracy)}</div><div className="tile-l">Quote accuracy: Sept runs inside their quote (backtest)</div></div>
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
              <tr key={tm.team} className="team-row"><td>{tm.team}</td><td className="num">{money(tm.budget)}</td><td className="num">{money(tm.actual)}</td><td className={`num ${tm.actual > tm.budget ? 'bad' : 'ok'}`}>{money(tm.actual - tm.budget)}</td></tr>,
              ...inits.filter((i) => i.team === tm.team).map((i) => (
                <tr key={i.initiative}><td className="indent">{i.initiative}</td><td className="num">{money(i.budget)}</td><td className="num">{money(i.actual)}</td><td className={`num ${i.variance > 0 ? 'bad' : 'ok'}`}>{money(i.variance)}</td></tr>
              )),
            ])}</tbody>
          </table>
        </div>
      </section>

      <section className="card highlight">
        <h3>Latest run from the engineer view</h3>
        {state.heroReceipt ? (
          <p>{hero.id} · {hero.developer} · <b>{hero.capability}</b> · {usd(hero.actualCost)} vs quote {usd(hero.quote.low)} – {usd(hero.quote.high)} · {state.heroReceipt.choice === 'platform' ? 'deeper platform fix' : 'surface fix'} · PR #{hero.prNumber} (simulated) · {offPlan.some((o) => o.task.id === hero.id) ? 'off plan, surfaced below.' : 'on plan, so not surfaced below.'}</p>
        ) : <p className="muted">{hero.id} ({hero.capability}) is still running in the engineer view. Play it to the receipt and it appears here.</p>}
      </section>

      <section className="card">
        <h3>Needs a decision: {paused.id}, {paused.capability}</h3>
        <p className="muted">{paused.team} · {paused.developer} · {paused.type} {paused.size} in {paused.repoArea} · quote {usd(paused.quote.low)} – {usd(paused.quote.high)}</p>
        {state.pausedDecision ? (
          <p><span className="pill ok">resolved</span> Chose <b>{state.pausedDecision.label}</b>. Final cost {usd(paused.actualCost)}{state.pausedDecision.delivered ? '' : '; capability not delivered'}. Every view now reflects this.</p>
        ) : (
          <>
            <p><b>Why it stopped:</b> {PAUSED_SCENARIO.why} Spent {usd(paused.actualCost)} against a ceiling of {usd(paused.quote.high)}.</p>
            <p><b>What changed:</b> {PAUSED_SCENARIO.changed} {PAUSED_SCENARIO.doneUnits} of {PAUSED_SCENARIO.discoveredUnits} {PAUSED_SCENARIO.unitLabel} done.</p>
            <div className="options">{options.map((o) => (
              <button key={o.key} className="option" onClick={() => dispatch({ kind: 'resolvePaused', option: o })}>
                <b>{o.label}</b><span>+{usd(o.addedCost)} → total {usd(o.finalCost)}</span><span className="muted">{o.detail}</span>
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
            <tr key={o.task.id}><td>{o.task.id}</td><td>{o.task.team}</td><td>{o.task.capability}</td>
              <td className="num">{usd(o.task.quote.low)} – {usd(o.task.quote.high)}</td><td className="num">{usd(o.task.actualCost)}</td>
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

      <section className="card">
        <h3>Justified tagging queue ({queue.length} untagged)</h3>
        <p className="muted">Was this run worth its cost? Tags update the justified rate and tag coverage above.</p>
        {queue.length === 0 ? <p className="pill ok">All completed runs are tagged.</p> : (
          <div className="queue">
            <table>
              <thead><tr><th>Task</th><th>Date</th><th>Team</th><th>Capability</th><th>Type</th><th className="num">Actual</th><th></th></tr></thead>
              <tbody>{queue.map((t) => (
                <tr key={t.id}><td>{t.id}</td><td>{t.date}</td><td>{t.team}</td><td>{t.capability}</td><td>{t.type} {t.size}</td><td className="num">{usd(t.actualCost)}</td>
                  <td className="actions"><button onClick={() => dispatch({ kind: 'tag', taskId: t.id, justified: 'yes' })}>Yes</button><button onClick={() => dispatch({ kind: 'tag', taskId: t.id, justified: 'no' })}>No</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
