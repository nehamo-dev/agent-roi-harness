import { useState } from 'react';
import { q4Summary, type DeptStatus } from '../core/q4';
import { capabilityRows } from '../core/selectors';
import { ORG_ENGINEERS } from '../data/enterprise';
import { useStore } from '../state/store';
import { money, moneyRange } from './fmt';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

const STATUS_LABEL: Record<DeptStatus, string> = {
  ok: 'On or under budget',
  watch: 'Watch: teams over, or the forecast range runs above budget',
  over: 'Over budget',
};

export function CfoView() {
  const { state } = useStore();
  const [deptName, setDeptName] = useState('Engineering');
  const q4 = q4Summary(state, money);
  const dept = q4.depts.find((d) => d.name === deptName) ?? q4.depts[0];
  const asOf = dayLabel(q4.asOf);
  const rows = capabilityRows(state);

  return (
    <div className="cfo">
      <div className="cfo-top" data-tour="cfo-top">
        <div>
          <h2 className="cfo-title">AI spend, Q4 2026 so far</h2>
          <p className="cfo-subtitle">All departments: forecast of {moneyRange(q4.all.low, q4.all.high)} for the quarter, with {money(q4.all.soFar)} spent through {asOf}. Engineering is about {Math.round(q4.engShare * 100)}% of it.</p>
        </div>
        <div className="quarter-switch">
          <button disabled>Q3 2026 · Closed</button>
          <button className="active" data-tour="cfo-q4">Q4 2026 · Current</button>
        </div>
      </div>

      <div className="dept-tabs" data-tour="cfo-depts">{q4.depts.map((d) => (
        <button key={d.name} className={d.name === dept.name ? 'dept active' : 'dept'} onClick={() => setDeptName(d.name)} data-tour={`cfo-dept-${d.name}`}>
          <span className={`dot ${d.status}`} /><b>{d.name}</b><span className="dept-figs">Forecast {moneyRange(d.low, d.high)} · {money(d.soFar)} so far</span>
        </button>
      ))}</div>
      <div className="dept-legend">{(['ok', 'watch', 'over'] as DeptStatus[]).map((st) => <span key={st}><span className={`dot ${st}`} />{STATUS_LABEL[st]}</span>)}</div>

      <section className="q4-card">
        <p className="muted">Where the quarter is heading, from recent weeks and known commitments, with actual spend through {asOf} beside it.</p>
        <div className="q4-boxes" data-tour="cfo-figures">
          <div className="q4-box q4-lead">
            <div className="cfo-label">Forecast for the quarter</div>
            <div className="cfo-big">{moneyRange(dept.low, dept.high)}</div>
            <div className="cfo-sub">Against a {money(dept.budget)} budget. Q3 actual was {money(dept.priorQuarter)}</div>
          </div>
          <div className="q4-box">
            <div className="cfo-label">Actual so far</div>
            <div className="cfo-big">{money(dept.soFar)}</div>
            <div className="cfo-sub">Day {q4.elapsed} of {q4.days}, {Math.round((q4.elapsed / q4.days) * 100)}% of the quarter</div>
          </div>
          <div className="q4-box">
            <div className="cfo-label">Forecast accuracy</div>
            <div className="cfo-big">{Math.round((dept.accuracy.inside / dept.accuracy.weeks) * 100)}%</div>
            <div className="cfo-sub">{dept.accuracy.inside} of the last {dept.accuracy.weeks} weeks landed inside the forecast range</div>
          </div>
        </div>
        <h4 className="by-team-h">By team</h4>
        <div className="by-team" data-tour="cfo-teams">{dept.teams.map((t) => (
          <div key={t.team} className="team-line">
            <b>{t.team}</b>
            <div>Forecast {moneyRange(t.low, t.high)}<div className="cfo-sub">{money(t.soFar)} so far</div></div>
            <div className="muted">{t.note}</div>
          </div>
        ))}</div>
      </section>

      <section className="cfo-caps" data-tour="cfo-caps">
        <h4 className="by-team-h">Cost per capability, Q3 2026</h4>
          <table className="plain">
            <thead><tr><th>Capability</th><th>Initiative</th><th>Status</th><th className="num">Budget</th><th className="num">Spent</th><th className="num">Over / under</th></tr></thead>
            <tbody>{[...rows].sort((a, b) => b.over - a.over).map((r) => (
              <tr key={r.capability}>
                <td className={r.over > 0 ? 'accent' : ''}>{r.capability}</td><td>{r.initiative}</td><td>{r.status}</td>
                <td className="num">{money(r.budget)}</td><td className="num">{money(r.spent)}</td>
                <td className={`num${r.over > 0 ? ' accent' : ''}`}>{r.over > 0 ? '+' : ''}{money(r.over)}</td>
              </tr>
            ))}</tbody>
          </table>
      </section>

      <div className="cfo-foot" data-tour="cfo-foot">
        <p><b>Cost per outcome, not value.</b> These figures show what work cost against what was approved. They do not measure the business value of what was built.</p>
        <p className="muted">Synthetic data, modeled on a ~{ORG_ENGINEERS.toLocaleString('en-US')}-engineer org.</p>
      </div>

    </div>
  );
}
