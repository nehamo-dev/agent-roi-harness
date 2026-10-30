import { useEffect, useMemo, useRef, useState } from 'react';
import { decisionOptions, runRate, type DecisionKey } from '../core/decision';
import { estimate } from '../core/estimator';
import { followUp, heroTask, quoteHistory } from '../core/reducer';
import type { LogEvent } from '../core/eventlog';
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

  // Keep the newest message in view as the run plays.
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }); }, [step, state.pausedDecision, state.heroEscalated]);

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

  // Tool calls for each step come straight from the event log.
  const segment = (i: number): LogEvent[] => S.log.events.slice(i === 0 ? 0 : S.steps[i - 1].end + 1, S.steps[i].end + 1);
  const tool = (e: LogEvent, k: number) => {
    const verb = e.kind === 'read' ? 'Read' : e.kind === 'edit' ? 'Edit' : 'Bash';
    const target = e.file ?? e.cmd;
    const failed = (e.exitCode ?? 0) !== 0;
    return (
      <div key={k} className={`cc-tool${failed ? ' fail' : ''}`}>
        <span className="cc-tool-verb">{verb}</span><span className="cc-tool-target">{target}</span>
        {e.kind === 'command' || e.kind === 'test' ? <span className="cc-tool-exit">{failed ? `exit ${e.exitCode}` : 'ok'}</span> : null}
        <span className="cc-tool-cost">{tk(e.costDelta).replace(' tokens', '')}</span>
      </div>
    );
  };
  const notice = (s: RunStep) => s.flag && (
    <div className="cc-notice"><b>Harness</b> {s.flag.cls === 'repeated-read'
      ? <>The agent re-read <code>{s.flag.subject}</code> {s.flag.count} times without changing it. Kept the file in memory instead.</>
      : <>A test failed {s.flag.count} times in a row with no code change. Stopped the retries and had the agent find the cause, {S.testCause}.</>}
      <span className="saved"> Saved {tk(s.flag.dollarsSaved)}.</span></div>
  );
  const narration = (s: RunStep, i: number) => s.kind === 'started'
    ? `Working through the ${P.plannedUnits} services in the plan, one at a time. Starting with ${S.firstService}: shared client library first, then the service.`
    : s.kind === 'decision'
      ? null
      : i === 1 ? 'auth-service is done. Moving on to the next service.' : 'Next service. Running the integration tests after the change.';

  const chosenLabel: Record<DecisionKey, string> = {
    continue: `Do all ${P.discoveredUnits} services.`,
    'planned-only': `Finish the ${P.plannedUnits} planned and re-quote the rest.`,
    stop: 'Stop and revert.',
  };
  const final = decided && state.pausedDecision ? state.pausedDecision.finalCost : 0;
  const over = final - ceiling;
  const others = state.tasks.filter((t) => t.developer === hero.developer && t.id !== hero.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const pct = Math.min(1, spent / Math.max(spent, ceiling));
  const caught = shown.filter((s) => s.flag);

  return (
    <div className="cc-window">
      <div className="cc-titlebar">
        <span className="cc-lights"><i /><i /><i /></span>
        <span className="cc-title">{S.ticket} · {S.title}</span>
        <span className="cc-sim">simulated session · synthetic data</span>
      </div>
      <div className="cc-body">
        <aside className="cc-sidebar">
          <div className="cc-side-h">Sessions</div>
          <div className="cc-session active"><span className={`cc-dot st-${status[1]}`} />{S.title}<small>{hero.id} · {status[0]}</small></div>
          {others.map((t) => (
            <div key={t.id} className="cc-session"><span className="cc-dot st-dim" />{t.capability}<small><TaskLink id={t.id} /> · {t.date}</small></div>
          ))}
        </aside>

        <main className="cc-main">
          <div className="cc-transcript" ref={transcript}>
            <div className="cc-user">
              Implement {S.ticket}: {S.title.toLowerCase()}. {S.summary} <TaskLink id={hero.id}>Full ticket and design doc ↗</TaskLink>
            </div>
            <div className="cc-agent">
              <p>Here is the design I will follow:</p>
              <ul>{S.design.map((d) => <li key={d}>{fill(d)}</li>)}</ul>
              <p className="muted">{fill(S.outOfScope)} {S.mainRisk}</p>
              {step === 0 && <p>The quote is in the economics panel. Approve it there and I will start.</p>}
            </div>
            {shown.map((s, i) => (
              <div key={i} className="cc-turn">
                {narration(s, i) && <div className="cc-agent"><p>{narration(s, i)}</p></div>}
                <div className="cc-tools">{segment(i).map(tool)}</div>
                {notice(s)}
                {s.kind === 'decision' && (
                  <div className="cc-agent cc-stop">
                    <p><b>I need a decision before going further.</b> The job is bigger than planned: I found <b>{P.discoveredUnits} services</b> that need mTLS, not the {P.plannedUnits} in the plan, and {S.sidecarNote}. Spend has passed the {tk(ceiling)} ceiling, and finishing all {P.discoveredUnits} would take about {tk(options[0].finalCost)}.</p>
                    <p className="muted">Paused at {tk(s.spentAfter)} with {s.servicesDone} of {P.discoveredUnits} services done. Options are in the economics panel.</p>
                  </div>
                )}
              </div>
            ))}
            {(decided || escalated) && <div className="cc-user">{chosenLabel[escalated && !decided ? 'continue' : decided!]}</div>}
            {escalated && <div className="cc-agent"><p>{state.decidedBy === 'leader' && state.pausedDecision ? `Your leader chose “${state.pausedDecision.label}”.` : 'That is above your approval limit, so I sent it to your leader and stayed paused.'}</p></div>}
            {decided === 'planned-only' && <div className="cc-agent"><p>Done. The planned {P.plannedUnits} services are on mTLS and the PR is open. The other {P.discoveredUnits - P.plannedUnits} are in a new task{split ? <> (<TaskLink id={split.id} />)</> : null} with their own quote.</p></div>}
            {decided === 'stop' && <div className="cc-agent"><p>Reverted the partial changes. Nothing ships; the scope finding is in the ticket.</p></div>}
          </div>
          <div className="cc-input"><span>Replay only · this session is simulated</span><button disabled>↑</button></div>
        </main>

        <aside className="cc-panel" aria-label="Economics">
          <div className="cc-panel-h"><b>Economics</b><span className="muted small">{hero.id} · tokens</span></div>

          <section className="cc-sec">
            <div className="eyebrow">Quote</div>
            <div className="cc-big">{tk(hero.quote.low).replace(' tokens', '')} – {tk(ceiling)}</div>
            <p className="small">The plan assumed <b>{P.plannedUnits} services</b>. The ceiling is {tk(ceiling)}. {ceiling > AUTO_APPROVE_LIMIT ? `Above your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so you approve it first.` : `Under your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so it starts on its own.`}</p>
            <div className="cc-actions">
              <button className="btn-primary" onClick={mainAction}>{step === 0 && !playing ? `Approve ${tk(ceiling)} and start` : playing ? 'Stop and reset' : 'Replay'}</button>
              <button onClick={() => { stopTimer(); advance(); }} disabled={atDecision}>Step</button>
            </div>
          </section>

          <section className="cc-sec">
            <div className="eyebrow">Spend</div>
            <div className="cc-meter-row"><b>{tk(spent)}</b><span className="muted small">of {tk(ceiling)} ceiling</span></div>
            <div className="cc-meter"><div className={spent > ceiling ? 'over' : ''} style={{ width: `${pct * 100}%` }} />{spent > ceiling && <span className="cc-ceiling" style={{ left: `${(ceiling / spent) * 100}%` }} />}</div>
            <div className="small">Services {doneText} · <span className={`st-${status[1]}`}>{status[0]}</span></div>
          </section>

          <section className="cc-sec">
            <div className="eyebrow">Waste caught</div>
            {caught.length === 0 ? <p className="muted small">Nothing yet.</p> : (
              <ul className="cc-caught">{caught.map((s) => (
                <li key={s.flag!.subject}>{s.flag!.cls === 'repeated-read' ? `Repeated reads of ${s.flag!.subject}` : `Retry loop on ${s.flag!.subject}`}<span className="saved-v">{tk(s.flag!.dollarsSaved)}</span></li>
              ))}</ul>
            )}
          </section>

          {atDecision && !decided && !escalated && hero.status === 'paused' && (
            <section className="cc-sec cc-decide">
              <div className="eyebrow">Needs a decision</div>
              <p className="small">The job is bigger than quoted. Each choice shows what it costs from here, and who is allowed to make it.</p>
              {options.map((o) => (
                <button key={o.key} className="cc-opt" onClick={() => choose(o.key)}>
                  <span className="cc-opt-top"><b>{o.label}</b><b>+{tk(o.addedCost)}</b></span>
                  <span className="muted small">total {tk(o.finalCost)} · {o.key === 'continue' ? `${tk(rate)} per service` : o.detail}</span>
                  {o.addedCost > AUTO_APPROVE_LIMIT
                    ? <span className="authority warn">Above your approval limit. Goes to your leader.</span>
                    : <span className="authority ok">You can decide this.</span>}
                </button>
              ))}
            </section>
          )}

          {escalated && (
            <section className="cc-sec cc-escalated">
              <b>Sent to your leader</b>
              <p className="small">{state.decidedBy === 'leader' && state.pausedDecision
                ? <>Your leader chose “{state.pausedDecision.label}”. Final cost {tk(state.pausedDecision.finalCost)}. </>
                : <>Doing all {P.discoveredUnits} services costs more than you can approve alone. The run stays paused at {tk(pausedCost)} until they decide. </>}
                <button className="link" onClick={onOpenLeader}>Open it in the Leader view →</button></p>
            </section>
          )}

          {decided && decided !== 'continue' && (
            <section className="cc-sec">
              <div className="eyebrow">Receipt</div>
              <div className="small muted">Capability: {decided === 'planned-only' ? `mTLS on ${P.plannedUnits} of ${P.discoveredUnits} services` : 'not delivered'}</div>
              <div className="cc-receipt">
                <div><span className="muted small">Quoted</span><b>{tk(ceiling)}</b><span className="muted small">ceiling, for {P.plannedUnits} services</span></div>
                <div><span className="muted small">Spent</span><b>{tk(final)}</b><span className="muted small">{decided === 'planned-only' ? `${tk(over)} over, ${Math.round((over / ceiling) * 100)}% over` : `${tk(over)} over the ceiling`}</span></div>
                <div><span className="muted small">Waste caught</span><b className="saved-v">{tk(wasteCaught(S))}</b><span className="muted small">repeated reads and retries</span></div>
              </div>
              <p className="small">{decided === 'planned-only'
                ? `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You finished the planned ${P.plannedUnits} and split the other ${P.discoveredUnits - P.plannedUnits} into a new task, so the extra spend is explained by a scope change, not by waste.`
                : `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You stopped early to avoid a ${tk(options[0].finalCost)} bill. The ${tk(final)} bought a clear answer about the real scope, not a shipped capability.`}</p>
              <p className="small"><span className="muted">{decided === 'planned-only' ? <>Simulated PR #{hero.prNumber} · new task {split ? <TaskLink id={split.id} /> : null}</> : 'No PR. Partial changes reverted.'}</span> · <button className="link" onClick={onOpenLeader}>Now visible to your leader →</button></p>
            </section>
          )}

          <section className="cc-sec">
            <button className="eng-hood-toggle" onClick={() => setOpen((v) => !v)}><span>Under the hood</span><span className="accent-text">{open ? 'Hide' : 'Show'}</span></button>
            {open && (
              <div className="cc-hood small">
                <p><b>Where the quote came from.</b> The estimator looked at {est.poolSize} past {hero.type === 'migration' ? 'infrastructure migrations' : 'tasks'} of similar size. It assumed {P.plannedUnits} services because the ticket listed {P.plannedUnits}. The leader and CFO views convert tokens to dollars at a synthetic $6 per million.</p>
                <p><b>Why the first two stops were automatic.</b> The detector reads the session log. A repeat with nothing changed in between is waste, so it is fixed without asking. A repeat after a real edit is left alone.</p>
                <p><b>Why the third stop asked you.</b> Spend crossed the ceiling and the remaining work was a different size than planned. That is a scope decision with a real cost, so a person makes it.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
