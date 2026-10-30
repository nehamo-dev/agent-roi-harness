import { useEffect, useMemo, useRef, useState } from 'react';
import { decisionOptions, runRate, type DecisionKey } from '../core/decision';
import { estimate } from '../core/estimator';
import { followUp, heroTask, quoteHistory } from '../core/reducer';
import type { Flag } from '../core/detector';
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
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selected, setSelected] = useState<DecisionKey | null>(null);
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
  const reset = () => { stopTimer(); setStep(0); setSelected(null); setQuoteOpen(false); dispatch({ kind: 'resetHero', initial }); };
  const mainAction = () => (step === 0 && !playing ? play() : reset());

  const choose = (key: DecisionKey) => {
    const o = options.find((x) => x.key === key)!;
    if (o.addedCost > AUTO_APPROVE_LIMIT) dispatch({ kind: 'escalate' });
    else dispatch({ kind: 'resolvePaused', option: o, by: 'engineer' });
  };

  // A pending decision is drafted into the input bar: the cheapest option that still ships and is within the engineer's limit.
  const pending = step >= last && !decided && !escalated && hero.status === 'paused';
  const defaultChoice = options.filter((o) => o.delivered && o.addedCost <= AUTO_APPROVE_LIMIT).sort((a, b) => a.addedCost - b.addedCost)[0]?.key ?? null;
  useEffect(() => { if (pending && selected === null) setSelected(defaultChoice); }, [pending, selected, defaultChoice]);
  const selectedOption = options.find((o) => o.key === selected);

  // Status bar.
  const shown = steps.slice(0, step);
  const atDecision = step >= last;
  const spent = decided && state.pausedDecision ? state.pausedDecision.finalCost : shown.length ? shown[shown.length - 1].spentAfter : 0;
  const done = decided === 'planned-only' ? P.plannedUnits : shown.length ? shown[shown.length - 1].servicesDone : 0;
  const total = atDecision ? P.discoveredUnits : P.plannedUnits;
  const doneText = decided === 'stop' ? `0 of ${P.discoveredUnits} (reverted)` : `${done} of ${total}`;
  const status = decided === 'planned-only' ? ['finished, partial scope', 'ok'] : decided === 'stop' ? ['stopped and reverted', 'dim']
    : escalated ? ['paused, waiting for VP Engineering', 'warn'] : atDecision ? ['paused, decision needed', 'bad'] : step > 0 ? ['running', 'ok'] : ['not started', 'dim'];

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
  const notice = (f: Flag) => (
    <div key={f.subject} className="cc-notice"><b>Self-correction</b> {f.cls === 'repeated-read'
      ? <>Re-read <code>{f.subject}</code> {f.count}× unchanged; kept it in memory.</>
      : <><code>{f.subject}</code> failed {f.count}× with no change; stopped it. Cause: {S.causes[f.subject] ?? 'see the log'}.</>}
      <span className="saved"> Saved {tk(f.dollarsSaved).replace(' tokens', '')}.</span></div>
  );
  const narration = (s: RunStep, i: number) => s.kind === 'started' ? `Starting with ${S.firstService}.`
    : s.kind === 'decision' ? 'Next services, then a scope check.' : i === 1 ? 'Next service.' : 'Next service, then integration tests.';

  const chosenLabel: Record<DecisionKey, string> = {
    continue: `Do all ${P.discoveredUnits} services.`,
    'planned-only': `Finish the ${P.plannedUnits} planned and re-quote the rest.`,
    stop: 'Stop and revert.',
  };
  const final = decided && state.pausedDecision ? state.pausedDecision.finalCost : 0;
  const over = final - ceiling;
  const others = state.tasks.filter((t) => t.developer === hero.developer && t.id !== hero.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const pct = Math.min(1, spent / Math.max(spent, ceiling));
  const caught = shown.flatMap((s) => s.flags);

  const planList = (
    <div className="cc-plan">
      <div className="eyebrow">What the quote covers</div>
      <ul>{S.design.map((d) => (
        <li key={d.name}><span>{fill(d.name)}</span><span>{tk(hero.quote.low * d.share).replace(' tokens', '')} – {tk(ceiling * d.share).replace(' tokens', '')}</span></li>
      ))}</ul>
      <div className="cc-plan-total"><span>Total</span><span>{tk(hero.quote.low).replace(' tokens', '')} – {tk(ceiling)}</span></div>
    </div>
  );

  return (
    <div className="cc-window" data-tour="eng-window">
      <div className="cc-titlebar">
        <span className="cc-lights" aria-hidden="true"><i className="close" /><i className="min" /><i className="max" /></span>
        <span className="cc-title"><b>Claude Desktop app</b> · {S.ticket} · {S.title}</span>
        <span className="cc-sim">simulated session · synthetic data</span>
      </div>
      <div className="cc-body">
        <aside className="cc-sidebar">
          <div className="cc-side-h">Sessions</div>
          <div className="cc-session active"><span className={`cc-dot st-${status[1]}`} />{S.title}<small><TaskLink id={hero.id} /> · {status[0]}</small></div>
          {others.map((t) => (
            <div key={t.id} className="cc-session"><span className="cc-dot st-dim" />{t.capability}<small><TaskLink id={t.id} /> · {t.date}</small></div>
          ))}
        </aside>

        <main className="cc-main">
          <div className="cc-transcript" ref={transcript}>
            <div className="cc-user">
              Implement {S.ticket}: {S.title.toLowerCase()}. <TaskLink id={hero.id}>Ticket ↗</TaskLink>
            </div>
            <div className="cc-agent">
              <p>Here is the design I will follow:</p>
              <ul>{S.design.map((d) => <li key={d.name}>{fill(d.text)}</li>)}</ul>
              <p className="muted">{fill(S.outOfScope)} {S.mainRisk}</p>
              {step === 0 && <p>The quote for each part is in the economics panel. Send the approval below to start.</p>}
            </div>
            {shown.map((s, i) => (
              <div key={i} className="cc-turn">
                {narration(s, i) && <div className="cc-agent"><p>{narration(s, i)}</p></div>}
                <div className="cc-tools">{segment(i).map(tool)}</div>
                {s.flags.map(notice)}
                {s.kind === 'decision' && (
                  <div className="cc-agent cc-stop">
                    <p><b>Paused for a decision.</b> Found <b>{P.discoveredUnits} services</b> that need mTLS, not {P.plannedUnits}. Spend passed the {tk(ceiling).replace(' tokens', '')} ceiling; all {P.discoveredUnits} would take about {tk(options[0].finalCost)}. Options are in the panel.</p>
                  </div>
                )}
              </div>
            ))}
            {(decided || escalated) && <div className="cc-user">{chosenLabel[escalated && !decided ? 'continue' : decided!]}</div>}
            {escalated && <div className="cc-agent"><p>{state.decidedBy === 'leader' && state.pausedDecision ? `Your VP of Engineering chose “${state.pausedDecision.label}”.` : 'Above your limit, so it went to your VP of Engineering. Staying paused.'}</p></div>}
            {decided === 'planned-only' && <div className="cc-agent"><p>Done: {P.plannedUnits} services on mTLS, PR open. The other {P.discoveredUnits - P.plannedUnits} are in {split ? <TaskLink id={split.id} /> : 'a new task'}.</p></div>}
            {decided === 'stop' && <div className="cc-agent"><p>Reverted. Nothing ships.</p></div>}
          </div>
          {step === 0 && !playing
            ? <div className="cc-input draft"><span>Approve {tk(ceiling)} and start</span><button className="btn-primary" onClick={play} aria-label="Send" data-tour="eng-send">↑</button></div>
            : pending && selectedOption
              ? <div className="cc-input draft"><span>{selectedOption.label} <span className="muted">· +{tk(selectedOption.addedCost)}{selectedOption.addedCost > AUTO_APPROVE_LIMIT ? ', goes to your VP of Engineering' : ''}</span></span><button className="btn-primary" onClick={() => choose(selectedOption.key)} aria-label="Send decision" data-tour="eng-send-decision">↑</button></div>
              : <div className="cc-input"><span>Replay only · this session is simulated</span><button disabled aria-label="Send">↑</button></div>}
        </main>

        <aside className="cc-panel" aria-label="Economics" data-tour="eng-panel">
          <div className="cc-panel-h"><span><b>Economics</b> <span className="cc-new">New</span></span><span className="muted small"><TaskLink id={hero.id} /> · tokens</span></div>

          {pending && (
            <section className="cc-sec cc-decide" data-tour="eng-decide">
              <div className="eyebrow">Needs a decision</div>
              <p className="small">The job is bigger than quoted. Pick an option; it is drafted in the message box. Send to confirm.</p>
              {options.map((o) => (
                <button key={o.key} className={`cc-opt${o.key === selected ? ' selected' : ''}`} onClick={() => setSelected(o.key)} aria-pressed={o.key === selected} data-tour={`eng-opt-${o.key}`}>
                  <span className="cc-opt-top"><b>{o.label}</b><b>+{tk(o.addedCost)}</b></span>
                  <span className="muted small">total {tk(o.finalCost)} · {o.key === 'continue' ? `${tk(rate)} per service` : o.detail}</span>
                  {o.addedCost > AUTO_APPROVE_LIMIT
                    ? <span className="authority warn">Above your approval limit. Goes to your VP of Engineering.</span>
                    : <span className="authority ok">You can decide this.</span>}
                </button>
              ))}
            </section>
          )}

          {escalated && (
            <section className="cc-sec cc-escalated" data-tour="eng-escalated">
              <b>Sent to your VP of Engineering</b>
              <p className="small">{state.decidedBy === 'leader' && state.pausedDecision
                ? <>Your VP of Engineering chose “{state.pausedDecision.label}”. Final cost {tk(state.pausedDecision.finalCost)}. </>
                : <>Doing all {P.discoveredUnits} services costs more than you can approve alone. The run stays paused at {tk(pausedCost)} until they decide. </>}
                <button className="link" onClick={onOpenLeader}>Open it in the VP Engineering view →</button></p>
            </section>
          )}

          {decided && decided !== 'continue' && (
            <section className="cc-sec">
              <div className="eyebrow">Receipt</div>
              <div className="small muted">Capability: {decided === 'planned-only' ? `mTLS on ${P.plannedUnits} of ${P.discoveredUnits} services` : 'not delivered'}</div>
              <div className="cc-receipt">
                <div><span className="muted small">Quoted</span><b>{tk(ceiling)}</b><span className="muted small">ceiling, for {P.plannedUnits} services</span></div>
                <div><span className="muted small">Spent</span><b>{tk(final)}</b><span className="muted small">{decided === 'planned-only' ? `${tk(over)} over, ${Math.round((over / ceiling) * 100)}% over` : `${tk(over)} over the ceiling`}</span></div>
                <div><span className="muted small">Self-corrections</span><b className="saved-v">{tk(wasteCaught(S))}</b><span className="muted small">{steps.flatMap((x) => x.flags).length} repeated reads and retries stopped</span></div>
              </div>
              <p className="small">{decided === 'planned-only'
                ? `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You finished the planned ${P.plannedUnits} and split the other ${P.discoveredUnits - P.plannedUnits} into a new task, so the extra spend is explained by a scope change, not by waste.`
                : `The plan assumed ${P.plannedUnits} services and the real job was ${P.discoveredUnits}. You stopped early to avoid a ${tk(options[0].finalCost)} bill. The ${tk(final)} bought a clear answer about the real scope, not a shipped capability.`}</p>
              <p className="small"><span className="muted">{decided === 'planned-only' ? <>Simulated PR #{hero.prNumber} · new task {split ? <TaskLink id={split.id} /> : null}</> : 'No PR. Partial changes reverted.'}</span> · <button className="link" onClick={onOpenLeader}>Now visible to your VP of Engineering →</button></p>
            </section>
          )}


          {step === 0 ? (
            <section className="cc-sec" data-tour="eng-quote">
              <div className="eyebrow">Quote</div>
              <div className="cc-big">{tk(hero.quote.low).replace(' tokens', '')} – {tk(ceiling)} <span className="cc-model">(on your approved model)</span></div>
              <p className="small">The plan assumed <b>{P.plannedUnits} services</b>. The ceiling is {tk(ceiling)}. {ceiling > AUTO_APPROVE_LIMIT ? `Above your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so you approve it first.` : `Under your ${tk(AUTO_APPROVE_LIMIT).replace(' tokens', '')}-token auto-approve limit, so it starts on its own.`}</p>
              {planList}
              <div className="cc-actions">
                <button className="btn-primary" onClick={mainAction}>{playing ? 'Stop and reset' : `Approve ${tk(ceiling)} and start`}</button>
                <button onClick={() => { stopTimer(); advance(); }} data-tour="eng-step">Step</button>
              </div>
            </section>
          ) : (
            <section className="cc-sec cc-quote-mini">
              <div className="cc-mini-row">
                <span><span className="eyebrow">Quote</span> <b>{tk(hero.quote.low).replace(' tokens', '')} – {tk(ceiling)}</b> <span className="cc-model">(on your approved model)</span></span>
                <button className="link" onClick={() => setQuoteOpen((v) => !v)}>{quoteOpen ? 'Hide' : 'Details'}</button>
              </div>
              {quoteOpen && planList}
              <div className="cc-actions">
                <button onClick={mainAction}>{playing ? 'Stop and reset' : 'Replay'}</button>
                <button onClick={() => { stopTimer(); advance(); }} disabled={atDecision} data-tour="eng-step">Step</button>
              </div>
            </section>
          )}

          <section className="cc-sec">
            <div className="eyebrow">Spend</div>
            <div className="cc-meter-row"><b>{tk(spent)}</b><span className="muted small">of {tk(ceiling)} ceiling</span></div>
            <div className="cc-meter"><div className={spent > ceiling ? 'over' : ''} style={{ width: `${pct * 100}%` }} />{spent > ceiling && <span className="cc-ceiling" style={{ left: `${(ceiling / spent) * 100}%` }} />}</div>
            <div className="small">Services {doneText} · <span className={`st-${status[1]}`}>{status[0]}</span></div>
          </section>

          <section className="cc-sec" data-tour="eng-selfheal">
            <div className="eyebrow">Self-corrections</div>
            {caught.length === 0 ? <p className="muted small">None yet. The harness steps in when the agent repeats work with nothing changed.</p> : (
              <>
                <ul className="cc-caught">{caught.map((f) => (
                  <li key={f.subject}><span>{f.cls === 'repeated-read' ? `Re-read ${f.subject} ${f.count}x` : `Retried ${f.subject} ${f.count}x`}</span><span className="saved-v">{tk(f.dollarsSaved)}</span></li>
                ))}</ul>
                <div className="cc-caught-total small"><span>Saved so far</span><b className="saved-v">{tk(caught.reduce((a, f) => a + f.dollarsSaved, 0))}</b></div>
              </>
            )}
          </section>

          <section className="cc-sec">
            <button className="eng-hood-toggle" onClick={() => setOpen((v) => !v)}><span>Under the hood</span><span className="accent-text">{open ? 'Hide' : 'Show'}</span></button>
            {open && (
              <div className="cc-hood small">
                <p><b>Where the quote came from.</b> The estimator looked at {est.poolSize} past {hero.type === 'migration' ? 'infrastructure migrations' : 'tasks'} of similar size. It assumed {P.plannedUnits} services because the ticket listed {P.plannedUnits}. The VP Engineering and CFO views convert tokens to dollars at a synthetic $6 per million.</p>
                <p><b>Why the self-corrections were automatic.</b> The detector reads the session log. A repeat with nothing changed in between is waste, so it is fixed without asking. A repeat after a real edit is left alone.</p>
                <p><b>Why the last stop asked you.</b> Spend crossed the ceiling and the remaining work was a different size than planned. That is a scope decision with a real cost, so a person makes it.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
