import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { tok, usd } from './fmt';

const Ctx = createContext<(id: string) => void>(() => {});

// Hosts the task detail panel; any TaskLink inside opens it.
export function TaskDetailHost({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Ctx.Provider value={setOpenId}>
      {children}
      {openId && <TaskSheet id={openId} onClose={() => setOpenId(null)} />}
    </Ctx.Provider>
  );
}

export function TaskLink({ id }: { id: string }) {
  const open = useContext(Ctx);
  return <button className="link" onClick={() => open(id)}>{id}</button>;
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state } = useStore();
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return null;
  const vsQuote = t.actualCost > t.quote.high ? `${usd(t.actualCost - t.quote.high)} over the top of its quote`
    : t.actualCost < t.quote.low ? `${usd(t.quote.low - t.actualCost)} under its quote` : 'within its quote';
  const rows: [string, ReactNode][] = [
    ['Capability', `${t.capability} (${t.initiative})`],
    ['Team · developer', `${t.team} · ${t.developer}`],
    ['Task', `${t.type}, size ${t.size}, ${t.repoArea}`],
    ['Date', t.date],
    ['Status', t.delivered === false ? 'stopped, not delivered' : t.status],
    ['Quote at start', `${usd(t.quote.low)} – ${usd(t.quote.high)}`],
    ['Actual cost', t.actualCost > 0 ? `${usd(t.actualCost)} · ${tok(t.actualCost)} · ${vsQuote}` : 'not finished yet'],
    ['Justified', t.justified === 'unset' ? 'not yet tagged' : t.justified],
    ['Pull request', `#${t.prNumber} (simulated)`],
  ];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet task-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="link sheet-close" onClick={onClose}>Close</button>
        <h3>{t.id} · {t.capability}</h3>
        <p className="muted">Synthetic task from the seeded history{t.role === 'hero' ? '; this is the run played in the engineer view' : t.role === 'paused-decision' ? '; this is the paused run on the leader view' : ''}.</p>
        <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
    </div>
  );
}
