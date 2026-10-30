import { useState } from 'react';
import { Area, Bar, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { q4Summary, type DeptStatus } from '../core/q4';
import { heroTask } from '../core/reducer';
import { capabilityRows, finishedWithinBudget, nextQuarterForecast, orgWeekly, overBudgetItems, pausedScopeCost, totalSpend } from '../core/selectors';
import { sum } from '../core/stats';
import { ORG_ENGINEERS } from '../data/enterprise';
import { useStore } from '../state/store';
import { money, moneyRange } from './fmt';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const addDays = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);

function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

type Sheet = 'trace' | 'all' | null;
type Quarter = 'Q3' | 'Q4';

const STATUS_LABEL: Record<DeptStatus, string> = {
  ok: 'On or under budget',
  watch: 'Watch: teams over, or the forecast range runs above budget',
  over: 'Over budget',
};

export function CfoView({ onOpenEngineer }: { onOpenEngineer: () => void }) {
  const { state } = useStore();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [quarter, setQuarter] = useState<Quarter>('Q4');
  const [deptName, setDeptName] = useState('Engineering');
  const q4 = q4Summary(state, money);
  const dept = q4.depts.find((d) => d.name === deptName) ?? q4.depts[0];
  const asOf = dayLabel(q4.asOf);
  const rows = capabilityRows(state);
  const total = totalSpend(state);
  const budgetTotal = sum(rows.map((r) => r.budget));
  const net = total - budgetTotal;
  const weeks = orgWeekly(state);
  const fc = nextQuarterForecast(state);
  const paused = pausedScopeCost(state);
  const over = overBudgetItems(state, money);
  const overSum = sum(over.map((o) => o.row.over));
  const rest = rows.filter((r) => r.over <= 0);
  const restInProgress = rest.filter((r) => r.status === 'in progress').length;
  const spentBy = (st: string) => sum(rows.filter((r) => r.status === st).map((r) => r.spent));
  const stopped = spentBy('stopped');
  const hero = heroTask(state);
  const heroRow = rows.find((r) => r.capability === hero.capability)!;

  const lastStart = weeks[weeks.length - 1].start;
  const chart = [
    ...weeks.map((w) => ({ label: dayLabel(w.start), spend: w.spend })),
    ...Array.from({ length: fc.horizon }, (_, i) => ({ label: dayLabel(addDays(lastStart, 7 * (i + 1))), band: [fc.weeklyLow, fc.weeklyHigh] as [number, number], mid: fc.weeklyMid })),
  ];
  const ticks = niceTicks(Math.max(...weeks.map((w) => w.spend), fc.weeklyHigh));

  return (
    <div className="cfo">
      <div className="cfo-top">
        <div>
          <h2 className="cfo-title">{quarter === 'Q4' ? 'AI spend, Q4 2026 so far' : 'AI spend, Q3 2026 · Engineering'}</h2>
          <p className="cfo-subtitle">{quarter === 'Q4'
            ? <>All departments: {money(q4.all.soFar)} spent through {asOf}, with a full-quarter forecast of {moneyRange(q4.all.low, q4.all.high)}. Engineering is about {Math.round(q4.engShare * 100)}% of it.</>
            : <>Closed quarter. Engineering only, where spend is tracked by capability.</>}</p>
        </div>
        <div className="quarter-switch">
          <button className={quarter === 'Q3' ? 'active' : ''} onClick={() => setQuarter('Q3')}>Q3 2026 · Closed</button>
          <button className={quarter === 'Q4' ? 'active' : ''} onClick={() => setQuarter('Q4')}>Q4 2026 · Current</button>
        </div>
      </div>

      {quarter === 'Q4' ? (
        <>
          <div className="dept-tabs">{q4.depts.map((d) => (
            <button key={d.name} className={d.name === dept.name ? 'dept active' : 'dept'} onClick={() => setDeptName(d.name)}>
              <span className={`dot ${d.status}`} /><b>{d.name}</b><span className="dept-figs">{money(d.soFar)} so far · Forecast {moneyRange(d.low, d.high)}</span>
            </button>
          ))}</div>
          <div className="dept-legend">{(['ok', 'watch', 'over'] as DeptStatus[]).map((st) => <span key={st}><span className={`dot ${st}`} />{STATUS_LABEL[st]}</span>)}</div>

          <section className="q4-card">
            <p className="muted">Actual spend through {asOf}, shown beside the forecast for the full quarter. The forecast uses recent weeks and known commitments.</p>
            <div className="q4-boxes">
              <div className="q4-box">
                <div className="cfo-label">Actual so far</div>
                <div className="cfo-big">{money(dept.soFar)}</div>
                <div className="cfo-sub">Day {q4.elapsed} of {q4.days}, {Math.round((q4.elapsed / q4.days) * 100)}% of the quarter</div>
              </div>
              <div className="q4-box">
                <div className="cfo-label">Full-quarter forecast</div>
                <div className="cfo-big">{moneyRange(dept.low, dept.high)}</div>
                <div className="cfo-sub">Against a {money(dept.budget)} budget. Q3 actual was {money(dept.priorQuarter)}</div>
              </div>
              <div className="q4-box">
                <div className="cfo-label">Forecast accuracy</div>
                <div className="cfo-big">{Math.round((dept.accuracy.inside / dept.accuracy.weeks) * 100)}%</div>
                <div className="cfo-sub">{dept.accuracy.inside} of the last {dept.accuracy.weeks} weeks landed inside the forecast range</div>
              </div>
            </div>
            <h4 className="by-team-h">By team</h4>
            <div className="by-team">{dept.teams.map((t) => (
              <div key={t.team} className="team-line">
                <b>{t.team}</b>
                <div>{money(t.soFar)} so far<div className="cfo-sub">Forecast {moneyRange(t.low, t.high)}</div></div>
                <div className="muted">{t.note}</div>
              </div>
            ))}</div>
          </section>
        </>
      ) : (
      <>
      <p className="cfo-headline">
        Over the last {weeks.length} weeks, engineering spent {money(total)} on AI coding. {over.length} {over.length === 1 ? 'capability' : 'capabilities'} ran over budget by {money(overSum)} combined; overall, spend came in {money(Math.abs(net))} {net <= 0 ? 'under' : 'over'} budget.
      </p>

      <div className="cfo-numbers">
        <div>
          <div className="cfo-label">Spent</div>
          <div className="cfo-big">{money(total)}</div>
          <div className="cfo-sub">{money(spentBy('delivered'))} delivered · {money(spentBy('in progress'))} in progress{stopped > 0 ? ` · ${money(stopped)} stopped` : ''}</div>
        </div>
        <div>
          <div className="cfo-label">Next {fc.horizon} weeks, likely range</div>
          <div className="cfo-big">{moneyRange(fc.low, fc.high)}</div>
          <div className="cfo-sub">Ongoing work plus the {paused.decided ? '' : 'open '}{paused.capability} decision</div>
        </div>
        <div>
          <div className="cfo-label">Tasks finished within budget</div>
          <div className="cfo-big">{Math.round(finishedWithinBudget(state) * 100)}%</div>
          <div className="cfo-sub">Of tasks finished this quarter</div>
        </div>
      </div>

      <div className="cfo-chart">
        <ResponsiveContainer>
          <ComposedChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} interval={3} />
            <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => money(v)} tickLine={false} axisLine={false} width={48} />
            <Bar dataKey="spend" fill="#4b5563" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Area dataKey="band" fill="#d1d5db" fillOpacity={0.7} stroke="#c4c8ce" isAnimationActive={false} />
            <Line dataKey="mid" stroke="#9ca3af" dot={false} strokeDasharray="4 3" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="cfo-legend"><span className="sw-bar" /> Weekly spend <span className="sw-band" /> Next {fc.horizon} weeks, likely range per week</div>
      </div>

      <h4 className="cfo-h">What went over budget</h4>
      <div className="cfo-over">
        {over.map((o) => (
          <div key={o.row.capability} className="cfo-item">
            <div className="cfo-item-name">{o.row.capability}</div>
            <div className="cfo-item-figs">
              <span className="accent">{o.inProgress ? 'Over budget so far' : 'Over by'} {money(o.row.over)}</span> · Budgeted {money(o.row.budget)} · Spent {money(o.row.spent)}
            </div>
            <p className={o.note ? 'cfo-note' : 'cfo-note missing'}>{o.note ?? 'No explanation from engineering yet.'}</p>
            <p className="cfo-effect"><span>Effect on forecast:</span> {o.effect}</p>
          </div>
        ))}
      </div>

      <p className="cfo-rest">
        The other {rest.length} capabilities came in under budget: {money(sum(rest.map((r) => r.spent)))} spent of {money(sum(rest.map((r) => r.budget)))} budgeted ({Math.round((sum(rest.map((r) => r.spent)) / sum(rest.map((r) => r.budget))) * 100)}%){restInProgress ? `, with ${restInProgress} still in progress` : ''}.
      </p>

      </>
      )}

      <div className="cfo-foot">
        <p><b>Cost per outcome, not value.</b> These figures show what work cost against what was approved. They do not measure the business value of what was built.</p>
        <div className="cfo-links">
          <button className="link" onClick={() => setSheet('all')}>See cost per capability</button>
          <button className="link" onClick={() => setSheet('trace')}>Follow {hero.capability} back to the engineer’s receipt</button>
        </div>
        <p className="muted">Synthetic data, modeled on a ~{ORG_ENGINEERS.toLocaleString('en-US')}-engineer org.</p>
      </div>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="link sheet-close" onClick={() => setSheet(null)}>Close</button>
            {sheet === 'trace' ? (
              <>
                <h3>{hero.capability}</h3>
                <p>Your run was one of {heroRow.runs.toLocaleString('en-US')} runs, {money(heroRow.spent)} total, against a budget of {money(heroRow.budget)}.</p>
                {state.pausedDecision ? (
                  <p>The engineer’s receipt: {money(hero.actualCost)} against a ceiling of {money(hero.quote.high)}, after “{state.pausedDecision.label}” ({state.decidedBy === 'engineer' ? `decided by ${hero.developer}` : 'decided by their leader'}), simulated PR #{hero.prNumber}. That {money(hero.actualCost)} is inside the {money(heroRow.spent)} above.</p>
                ) : hero.status === 'paused' ? (
                  <p>The run is paused at {money(hero.actualCost)} waiting for a decision, so it has no receipt yet.</p>
                ) : <p>The engineer’s run has not been played yet, so its cost is not in this total.</p>}
                <button className="link" onClick={() => { setSheet(null); onOpenEngineer(); }}>Open the engineer view</button>
              </>
            ) : (
              <>
                <h3>Cost per capability, Q3 2026</h3>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
