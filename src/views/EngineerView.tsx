import { useEffect, useMemo, useRef, useState } from 'react';
import { decisionOptions, runRate, type DecisionKey } from '../core/decision';
import { estimate } from '../core/estimator';
import { followUp, heroTask, quoteHistory } from '../core/reducer';
import { AUTO_APPROVE_LIMIT, runSteps, wasteCaught, type RunStep } from '../core/session';
import { HERO_SCENARIO as S } from '../data/heroScenario';
import { PAUSED_SCENARIO as P } from '../data/pausedScenario';
import { initial, useStore } from '../state/store';
import { tk } from './fmt';
import { TaskLink } from './TaskDetail';

const TICK_MS = 1400;
const fill = (text: string) => text.replace('{planned}', String(P.plannedUnits));

export function EngineerView({ onOpenLeader }: { onOpenLeader: () => void }) {
  const { state, dispatch } = useStore();
  const hero = heroTask(state);
  const steps = useMemo(() => runSteps(S), []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const last = steps.length;
  const ceiling = hero.quote.high;
  const pausedCost = steps[last - 1].spentAfter;

  // The decision is priced from the paused run, whatever its current state in the store.
  const pausedTask = { ...hero, actualCost: pausedCost };
  const options = decisionOptions(pausedTask, P);
  const rate = runRate(pausedTask, P);
  const choice: DecisionKey | null = state.pausedDecision?.key ?? null;
  const decided = state.decidedBy === 'engineer' ? choice : null;
  const escalated = state.heroEscalated;
  const split = followUp(state);
  const history = useMemo(() => quoteHistory(state), [state]);
  const est = useMemo(() => estimate({ type: hero.type, size: hero.size, repoArea: hero.repoArea, team: hero.team, developer: hero.developer }, history), [hero.type, hero.size, hero.repoArea, hero.team, hero.developer, history]);

  // Reaching the decision step writes the paused run to the shared store.
  useEffect(() => {
    if (step >= last && hero.status === 'running') dispatch({ kind: 'heroPaused', cost: pausedCost });
  }, [step, last, hero.status, pausedCost, dispatch]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setPlaying(false); };
  useEffect(() => stopTimer, []);
  useEffect(() => { if (step >= last) stopTimer(); }, [step, last]);
  const advance = () => setStep((i) => Math.min(i + 1, last));
  const play = () => { stopTimer(); setPlaying(true); setTimeout(advance, 400); timer.current = setInterval(advance, TICK_MS); };
  const reset = () => { stopTimer(); setStep(0); dispatch({ kind: 'resetHero', initial }); };
  const mainAction = () => (step === 0 && !playing ? play() : reset());

  const choose = (key: DecisionKey) => {
    const o = options.find((x) => x.key === key)!;
    if (o.addedCost > AUTO_APPROVE_LIMIT) dispatch({ kind: 'escalate' });
    else dispatch({ kind: 'resolvePaused', option: o, by: 'engineer' });
  };

  // Status bar.
  const shown = steps.slice(0, step);
  const atDecision = step >= last;
  const spent = decided && state.pausedDecision ? state.pausedDecision.finalCost : shown.length ? shown[shown.length - 1].spentAfter : 0;
  const done = decided === 'planned-only' ? P.plannedUnits : shown.length ? shown[shown.length - 1].servicesDone : 0;
  const total = atDecision ? P.discoveredUnits : P.plannedUnits;
  const doneText = decided === 'stop' ? `0 of ${P.discoveredUnits} (reverted)` : `${done} of ${total}`;
  const status = decided === 'planned-only' ? ['finished, partial scope', 'ok'] : decided === 'stop' ? ['stopped and reverted', 'dim']
    : escalated ? ['paused, waiting for leader', 'warn'] : atDecision ? ['paused, decision needed', 'bad'] : step > 0 ? ['running', 'ok'] : ['not started', 'dim'];

  const line = (s: RunStep, i: number) => {
    if (s.kind === 'started') return (
      <div key={i} className="eng-line"><span className="tag started">▶ Started</span>&nbsp; Working through the {P.plannedUnits} services in the plan, one at a time.
        <div className="eng-detail">migrate {S.firstService} to mTLS</div></div>);
    if (s.kind === 'corrected' && s.flag?.cls === 'repeated-read') return (
      <div key={i} className="eng-line"><span className="tag corrected">↺ Course-corrected</span>&nbsp; The agent re-read the same certificate config {s.flag.count} times without changing it. The harness had it keep the file in memory instead. <span className="saved">Saved {tk(s.flag.dollarsSaved)}.</span>
        <div className="eng-detail">read {s.flag.subject} x{s.flag.count}, no edit in between</div></div>);
    if (s.kind === 'corrected' && s.flag) return (
      <div key={i} className="eng-line"><span className="tag corrected">↺ Course-corrected</span>&nbsp; A test failed {s.flag.count} times in a row with no code change. The harness stopped the retries and had the agent find the cause, {S.testCause}. <span className="saved">Saved {tk(s.flag.dollarsSaved)}.</span>
        <div className="eng-detail">{s.flag.subject}, exit 1 x{s.flag.count}</div></div>);
    return (
      <div key={i} className="eng-line"><span className="tag decision">■ Decision needed</span>&nbsp; New discovery: the job is bigger than planned. The agent found <b>{P.discoveredUnits} services</b> that need mTLS, not the {P.plannedUnits} in the plan, and {S.sidecarNote}. Spend has passed the {tk(ceiling).replace(' tokens', '')}-token ceiling, and finishing all {P.discoveredUnits} would take about {tk(options[0].finalCost)}.
        <div className="eng-detail">scope: {P.plannedUnits} planned, {P.discoveredUnits} found, {s.servicesDone} done · paused at {tk(s.spentAfter)}</div></div>);
  };

  const chosenLabel: Record<DecisionKey, string> = {
    continue: `Do all ${P.discoveredUnits} services. It needs your leader, so it was sent to them.`,
    'planned-only': `Finish the ${P.plannedUnits} planned and re-quote the rest.`,
    stop: 'Stop and revert.',
  };
  const final = decided && state.pausedDecision ? state.pausedDecision.finalCost : 0;
  const over = final - ceiling;

  return (
    <div className="eng">
      <section className="eng-card">
        <div className="eng-head">
          <div className="eng-intro">
            <div className="muted small">{hero.developer} · {hero.team} · task <TaskLink id={hero.id} /> · <TaskLink id={hero.id}>{S.ticket} in Jira ↗</TaskLink> <span>(full ticket and design doc, simulated)</span></div>
            <h1>{S.title}</h1>
            <div className="eng-summary">{S.summary}</div>
          </div>
          <div className="eng-actions">
            <button className="btn-primary" onClick={mainAction}>{step === 0 && !playing ? `Approve ${tk(ceiling)} and start` : playing ? 'Stop and reset' : 'Replay'}</button>
            <button onClick={() => { stopTimer(); advance(); }} disabled={atDecision}>Step</button>
          </div>
        </div>
        <div className="eng-quote">
          <div className="eng-quote-row">
            <div><span className="eyebrow">Quote</span> <span className="eng-quote-v">{tk(hero.quote.low).replace(' tokens', '')} – {tk(ceiling)}</span></div>
            <div className="eng-summary">The plan assumed <b>{P.plannedUnits} services</b>. The ceiling is {tk(ceiling)}. {ceiling > AUTO_APPROVE_LIMIT ? `Above your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so you approve it first.` : `Under your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so it starts on its own.`}</div>
          </div>
          <div className="eng-design">
            <div className="eyebrow">What the design is</div>
            <ul>{S.design.map((d) => <li key={d}>{fill(d)}</li>)}</ul>
            <div className="muted">{fill(S.outOfScope)}</div>
            <div className="muted">{S.mainRisk}</div>
          </div>
        </div>
      </section>

      <section className="eng-term" aria-label="Simulated agent session">
        <div className="eng-bar"><span>agent session · simulated</span><span>{tk(spent)} / ceiling {tk(ceiling).replace(' tokens', '')} · services {doneText} · <span className={`st-${status[1]}`}>{status[0]}</span></span></div>
        <div className="eng-body">
          {step === 0 && <div className="eng-dim">Nothing has run yet. Use the blue button above to approve the ceiling and start.</div>}
          {shown.map(line)}
          {(decided || escalated) && <div className="eng-line"><span className="tag started">› You chose</span>&nbsp; {chosenLabel[escalated && !decided ? 'continue' : decided!]}</div>}
        </div>
      </section>

      {atDecision && !decided && !escalated && hero.status === 'paused' && (
        <section className="eng-card eng-decide">
          <h2>Needs a decision</h2>
          <p className="eng-summary">The job is bigger than quoted. Each choice shows what it costs from here, and who is allowed to make it.</p>
          <div className="eng-opts">{options.map((o) => (
            <button key={o.key} className="eng-opt" onClick={() => choose(o.key)}>
              <b>{o.label}</b>
              <div className="eng-opt-v">+{tk(o.addedCost)}</div>
              <div className="muted">total {tk(o.finalCost)}</div>
              <div className="eng-summary">{o.key === 'continue' ? `${o.detail.replace(/\.$/, '')} (${tk(rate)} per service).` : o.detail}</div>
              {o.addedCost > AUTO_APPROVE_LIMIT
                ? <div className="authority warn">Above your approval limit. Goes to your leader.</div>
                : <div className="authority ok">You can decide this.</div>}
            </button>
          ))}</div>
        </section>
      )}

      {escalated && (
        <section className="eng-card eng-escalated">
          <b>Sent to your leader</b>
          <p>{state.decidedBy === 'leader' && state.pausedDecision
            ? <>Your leader chose “{state.pausedDecision.label}”. Final cost {tk(state.pausedDecision.finalCost)}. </>
            : <>Doing all {P.discoveredUnits} services costs more than you can approve alone. The run stays paused at {tk(pausedCost)} until they decide. </>}
          <button className="link" onClick={onOpenLeader}>Open it in the Leader view →</button></p>
        </section>
      )}

      {decided && decided !== 'continue' && (
        <section className="eng-card">
          <div className="eng-receipt-head"><h2>Receipt</h2><span className="muted small">Capability: {decided === 'planned-only' ? `mTLS on ${P.plannedUnits} of ${P.discoveredUnits} services` : 'not delivered'}</span></div>
          <div className="eng-stats">
            <div className="eng-stat"><div className="muted small">Quoted</div><div className="eng-stat-v">{tk(ceiling)}</div><div className="muted small">ceiling, for {P.plannedUnits} services</div></div>
            <div className="eng-stat"><div className="muted small">Spent</div><div className="eng-stat-v">{tk(final)}</div><div className="muted small">{decided === 'planned-only' ? `${tk(over)} over the ceiling, ${Math.round((over / ceiling) * 100)}% over` : `${tk(over)} over the ceiling`}</div></div>
            <div className="eng-stat"><div className="muted small">Waste caught on the way</div><div className="eng-stat-v saved-v">{tk(wasteCaught(S))}</div><div className="muted small">repeated reads and retries</div></div>
          </div>
          <p>{decided === 'planned-only'
            ? `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You finished the planned ${P.plannedUnits} and split the other ${P.discoveredUnits - P.plannedUnits} into a new task, so the extra spend is explained by a scope change, not by waste.`
            : `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You stopped early to avoid a ${tk(options[0].finalCost)} bill. The ${tk(final)} bought a clear answer about the real scope, not a shipped capability.`}</p>
          <p className="eng-receipt-foot">
            <span className="muted">{decided === 'planned-only' ? <>Simulated PR #{hero.prNumber} · new task {split ? <TaskLink id={split.id} /> : null} for the other {P.discoveredUnits - P.plannedUnits} services</> : 'No PR. Partial changes reverted.'}</span>
            <button className="link" onClick={onOpenLeader}>Now visible to your leader →</button>
          </p>
        </section>
      )}

      <section className="eng-card eng-hood">
        <button className="eng-hood-toggle" onClick={() => setOpen((v) => !v)}>
          <span>Under the hood <span className="muted">· how the quote and the stops were decided</span></span><span className="accent-text">{open ? 'Hide' : 'Show'}</span>
        </button>
        {open && (
          <div className="eng-hood-body">
            <div><div className="eyebrow">Where the quote came from</div><p>The estimator looked at {est.poolSize} past {hero.type === 'migration' ? 'infrastructure migrations' : 'tasks'} of similar size. It assumed {P.plannedUnits} services because the ticket listed {P.plannedUnits}. Amounts are in tokens. The leader and CFO views convert them to dollars at a synthetic $6 per million tokens.</p></div>
            <div><div className="eyebrow">Why the first two stops were automatic</div><p>The detector reads the session log. A repeat with nothing changed in between is waste, so it is fixed without asking. A repeat after a real edit is left alone.</p></div>
            <div><div className="eyebrow">Why the third stop asked you</div><p>Spend crossed the ceiling and the remaining work was a different size than planned. That is a scope decision with a real cost, so a person makes it.</p></div>
          </div>
        )}
      </section>
    </div>
  );
}
