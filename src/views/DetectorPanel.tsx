import { useMemo, useState } from 'react';
import { detect, totalSaved } from '../core/detector';
import { logCost } from '../core/eventlog';
import { interventions } from '../core/interventions';
import { SAMPLE_LOGS } from '../data/logs';
import { tok, usd } from './fmt';

// Renders `backticked` names as inline code.
const code = (text: string) => text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

const CLEAN = 'clean-2';
const WASTEFUL = 'mixed-1';

export function DetectorPanel() {
  const [logId, setLogId] = useState(WASTEFUL);
  const [choice, setChoice] = useState<'fix' | 'skip' | null>(null);
  const log = SAMPLE_LOGS.find((l) => l.id === logId)!;
  const flags = useMemo(() => detect(log), [log]);
  const { auto, decision } = useMemo(() => interventions(log, flags), [log, flags]);
  const flagged = (i: number) => flags.some((f) => i >= f.start && i <= f.end);
  const pick = (id: string) => { setLogId(id); setChoice(null); };
  const chosen = decision?.options.find((o) => o.key === choice);

  return (
    <section className="card">
      <h3>Agent interventions</h3>
      <p className="muted">The harness watches each session's log. It fixes routine waste on its own and only stops for you at a real decision. Hand-authored sample logs (synthetic).</p>
      <div className="row">
        <button className={logId === CLEAN ? 'tab active' : 'tab'} onClick={() => pick(CLEAN)}>Clean log</button>
        <button className={logId === WASTEFUL ? 'tab active' : 'tab'} onClick={() => pick(WASTEFUL)}>Wasteful log</button>
        <label>Any sample <select value={logId} onChange={(e) => pick(e.target.value)}>{SAMPLE_LOGS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
      </div>
      <div className="two-col">
        <table>
          <thead><tr><th>#</th><th>Time</th><th>Event</th><th className="num">Cost</th></tr></thead>
          <tbody>{log.events.map((e, i) => (
            <tr key={i} className={flagged(i) ? 'flagged' : ''}>
              <td>{i}</td><td>{e.t}</td>
              <td>{e.kind === 'read' || e.kind === 'edit' ? `${e.kind} ${e.file}` : `${e.kind} ${e.cmd} (exit ${e.exitCode})`}</td>
              <td className="num">{usd(e.costDelta)} <span className="muted">· {tok(e.costDelta)}</span></td>
            </tr>
          ))}</tbody>
        </table>
        <div>
          <h4>Handled automatically</h4>
          {auto.length === 0 ? <p className="muted">Nothing to correct. The session ran clean.</p> : (
            <ul className="interventions">{auto.map((a) => (
              <li key={a.title}><b>{code(a.title)}.</b> {a.what} {a.action} <span className="ok-text">Saved {usd(a.saved)} ({tok(a.saved)}).</span></li>
            ))}</ul>
          )}
          <h4>Needs your decision</h4>
          {!decision ? <p className="muted">Nothing needs you.</p> : chosen ? (
            <p>You chose <b>{chosen.label.toLowerCase()}</b>. {chosen.cost > 0 ? `Estimated +${usd(chosen.cost)} (${tok(chosen.cost)}).` : 'No added cost now; a follow-up is logged.'} <button className="link" onClick={() => setChoice(null)}>Change</button></p>
          ) : (
            <>
              <p>{code(decision.question)}</p>
              <div className="decide">{decision.options.map((o) => (
                <button key={o.key} className="option" onClick={() => setChoice(o.key)}>
                  <b>{o.label}</b><span>{o.cost > 0 ? `+${usd(o.cost)} · ${tok(o.cost)}` : 'No added cost now'}</span><span className="muted">{o.detail}</span>
                </button>
              ))}</div>
            </>
          )}
          <p className="muted">Log cost {usd(logCost(log))} ({tok(logCost(log))}) · saved by interventions {usd(totalSaved(flags))} ({tok(totalSaved(flags))})</p>
        </div>
      </div>
    </section>
  );
}
