import { useState } from 'react';
import { useStore } from './state/store';
import { EngineerView } from './views/EngineerView';
import { CfoView } from './views/CfoView';
import { LeaderView } from './views/LeaderView';
import { TaskDetailHost } from './views/TaskDetail';

const TABS = ['Engineer', 'Leader', 'CFO'] as const;
type Tab = (typeof TABS)[number];

// One story, three views. About a minute each.
const STORY: Record<Tab, string> = {
  Engineer: 'Press Play. The agent quotes the task from similar past work, auto-approves, gets corrected by the waste detector, asks you to pick a trade-off, and ends with a receipt that lands in the shared store.',
  Leader: 'The same run now shows up in the budget. Only off-plan runs are surfaced. Decide the paused run and watch the totals and the CFO view move.',
  CFO: 'One screen in dollars: spent, likely next, and what went over budget and why.',
};

export function App() {
  const [tab, setTab] = useState<Tab>('Engineer');
  const [runKey, setRunKey] = useState(0);
  const { reset } = useStore();
  const restart = () => { reset(); setRunKey((k) => k + 1); setTab('Engineer'); };
  const step = TABS.indexOf(tab);
  return (
    <div className="app">
      <header>
        <div className="title">Economic harness <span className="muted">· demo</span></div>
        <nav>{TABS.map((t, i) => <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{i + 1}. {t}</button>)}</nav>
        <button className="reset" onClick={restart}>Reset demo</button>
      </header>
      <div className="banner">Synthetic data: all tasks, costs, teams and PRs are seeded and simulated. Not real usage.</div>
      <div className="story">
        <span><b>Step {step + 1} of 3 · {tab}.</b> {STORY[tab]}</span>
        {step < 2 ? <button onClick={() => setTab(TABS[step + 1])}>Next: {TABS[step + 1]} →</button> : <button onClick={restart}>Restart demo</button>}
      </div>
      {/* Views stay mounted so the engineer run survives tab switches. */}
      <TaskDetailHost>
      <main key={runKey}>
        <div hidden={tab !== 'Engineer'}><EngineerView /></div>
        <div hidden={tab !== 'Leader'}><LeaderView /></div>
        <div hidden={tab !== 'CFO'}><CfoView onOpenEngineer={() => setTab('Engineer')} /></div>
      </main>
      </TaskDetailHost>
    </div>
  );
}
