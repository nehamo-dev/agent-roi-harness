import { useState } from 'react';
import { useStore } from './state/store';
import { EngineerView } from './views/EngineerView';
import { CfoView } from './views/CfoView';
import { LeaderView } from './views/LeaderView';
import { TaskDetailHost } from './views/TaskDetail';
import { TABS, type Tab } from './views/tabs';
import { Tour } from './views/tour/Tour';
import { TOUR_STEPS } from './views/tour/steps';


// One story, three views. About a minute each.
const STORY: Record<Tab, string> = {
  Engineer: 'Press the blue button. The agent works on a real-sized job, the harness catches waste, then stops it when the plan turns out to be wrong.',
  'VP Engineering': 'The same run now shows up in the budget. Only off-plan runs are surfaced, with what was done about each.',
  CFO: 'The same runs now roll up to company spend. Only overspend is called out, by team, in plain language.',
};

export function App() {
  const [tab, setTab] = useState<Tab>('Engineer');
  const [runKey, setRunKey] = useState(0);
  const { reset } = useStore();
  const restart = () => { reset(); setRunKey((k) => k + 1); setTab('Engineer'); };
  const [tourKey, setTourKey] = useState<number | null>(null);
  const playDemo = () => { restart(); setTourKey((k) => (k ?? 0) + 1); };
  const step = TABS.indexOf(tab);
  return (
    <div className="app">
      <header>
        <div className="title">Economic harness <span className="muted">· demo</span></div>
        <nav>{TABS.map((t, i) => <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{i + 1}. {t}</button>)}</nav>
        <button className="btn-primary btn-play" onClick={playDemo}>▶ Play demo</button>
        <button className="reset" onClick={restart}>Reset demo</button>
      </header>
      <div className="banner">{tab === 'CFO' ? 'Synthetic data: all spend, budgets, teams and forecasts are seeded and illustrative. Not real usage.' : 'Synthetic data: all tasks, costs, teams and PRs are seeded and simulated. Not real usage.'}</div>
      <div className="story">
        <span><b>Step {step + 1} of 3 · {tab}.</b> {STORY[tab]}</span>
        {step < 2 ? <button onClick={() => setTab(TABS[step + 1])}>Next: {TABS[step + 1]} →</button> : <button onClick={restart}>Restart ↻</button>}
      </div>
      <hr className="sep" />
      {/* Views stay mounted so the engineer run survives tab switches. */}
      <TaskDetailHost>
      <main key={runKey}>
        <div hidden={tab !== 'Engineer'}><EngineerView onOpenVp={() => setTab('VP Engineering')} /></div>
        <div hidden={tab !== 'VP Engineering'}><LeaderView /></div>
        <div hidden={tab !== 'CFO'}><CfoView /></div>
      </main>
      </TaskDetailHost>
      {tourKey !== null && <Tour key={tourKey} steps={TOUR_STEPS} setTab={setTab} onExit={() => setTourKey(null)} onReplay={playDemo} />}
    </div>
  );
}
