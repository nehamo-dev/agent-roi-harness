import { useMemo, useState } from 'react';
import { estimate } from '../core/estimator';
import { completedTasks } from '../core/reducer';
import { REPO_AREAS, SIZES, TASK_TYPES, type RepoArea, type Size, type TaskType } from '../core/types';
import { useStore } from '../state/store';
import { usd } from './fmt';

export function TryItPanel() {
  const { state } = useStore();
  const [type, setType] = useState<TaskType>('feature');
  const [size, setSize] = useState<Size>('M');
  const [repoArea, setArea] = useState<RepoArea>('payments');
  const e = useMemo(() => estimate({ type, size, repoArea }, completedTasks(state)), [type, size, repoArea, state]);

  return (
    <section className="card">
      <h3>Try it: live quote</h3>
      <p className="muted">Pick a task. The estimator quotes from similar completed tasks in the synthetic history.</p>
      <div className="row">
        <label>Type <select value={type} onChange={(ev) => setType(ev.target.value as TaskType)}>{TASK_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Size <select value={size} onChange={(ev) => setSize(ev.target.value as Size)}>{SIZES.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Repo area <select value={repoArea} onChange={(ev) => setArea(ev.target.value as RepoArea)}>{REPO_AREAS.map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <div className="quote">
        <span className="big">{usd(e.quote.low)} – {usd(e.quote.high)}</span>
        <span className={e.confidence === 'low' ? 'pill warn' : 'pill ok'}>{e.confidence === 'low' ? 'low confidence' : 'normal confidence'}</span>
        <span className="muted">midpoint {usd(e.midpoint)} · {e.exactMatches} exact {e.exactMatches === 1 ? 'match' : 'matches'}</span>
      </div>
      <div className="two-col">
        <div><h4>Assumptions</h4><ul>{e.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>
        <div><h4>Risk factors</h4><ul>{e.risks.map((r) => <li key={r}>{r}</li>)}</ul></div>
      </div>
      <h4>Similar past tasks used ({e.similar.length} most recent shown)</h4>
      {e.similar.length === 0 ? <p className="muted">None: cold-start range.</p> : (
        <table>
          <thead><tr><th>Task</th><th>Date</th><th>Type</th><th>Size</th><th>Area</th><th>Team</th><th className="num">Actual</th></tr></thead>
          <tbody>{e.similar.map((t) => (
            <tr key={t.id}><td>{t.id}</td><td>{t.date}</td><td>{t.type}</td><td>{t.size}</td><td>{t.repoArea}</td><td>{t.team}</td><td className="num">{usd(t.actualCost)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
