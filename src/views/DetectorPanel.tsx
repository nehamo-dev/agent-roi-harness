import { useMemo, useState } from 'react';
import { detect, totalSaved } from '../core/detector';
import { logCost } from '../core/eventlog';
import { SAMPLE_LOGS } from '../data/logs';
import { tok, usd } from './fmt';

const CLEAN = 'clean-2';
const WASTEFUL = 'mixed-1';

export function DetectorPanel() {
  const [logId, setLogId] = useState(WASTEFUL);
  const log = SAMPLE_LOGS.find((l) => l.id === logId)!;
  const flags = useMemo(() => detect(log), [log]);
  const flagged = (i: number) => flags.some((f) => i >= f.start && i <= f.end);

  return (
    <section className="card">
      <h3>Waste detector</h3>
      <p className="muted">Runs the detector on a hand-authored sample log (synthetic). Flags retry loops and repeated reads of unchanged files.</p>
      <div className="row">
        <button className={logId === CLEAN ? 'tab active' : 'tab'} onClick={() => setLogId(CLEAN)}>Clean log</button>
        <button className={logId === WASTEFUL ? 'tab active' : 'tab'} onClick={() => setLogId(WASTEFUL)}>Wasteful log</button>
        <label>Any sample <select value={logId} onChange={(e) => setLogId(e.target.value)}>{SAMPLE_LOGS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
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
          <h4>Detector output</h4>
          {flags.length === 0 ? <p className="pill ok">No waste flagged</p> : (
            <ul>{flags.map((f) => <li key={`${f.cls}-${f.start}`}><b>{f.cls}</b> (events {f.start}–{f.end}): {f.message} Est. saved {usd(f.dollarsSaved)} ({tok(f.dollarsSaved)}).</li>)}</ul>
          )}
          <p className="muted">Log cost {usd(logCost(log))} ({tok(logCost(log))}) · estimated saved {usd(totalSaved(flags))} ({tok(totalSaved(flags))})</p>
        </div>
      </div>
    </section>
  );
}
