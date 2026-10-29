import { useEffect, useMemo, useRef, useState } from 'react';
import { estimate } from '../core/estimator';
import { heroTask, quoteHistory } from '../core/reducer';
import { buildSteps, computeReceipt, optionCost, type Choice } from '../core/session';
import { HERO_SCENARIO } from '../data/heroScenario';
import { initial, useStore } from '../state/store';
import { DetectorPanel } from './DetectorPanel';
import { tok, usd } from './fmt';
import { TaskLink } from './TaskDetail';
import { TryItPanel } from './TryItPanel';

const TICK_MS = 450;

export function EngineerView() {
  const { state, dispatch } = useStore();
  const hero = heroTask(state);
  const history = useMemo(() => quoteHistory(state), [state]);
  const est = useMemo(() => estimate({ type: hero.type, size: hero.size, repoArea: hero.repoArea, team: hero.team, developer: hero.developer }, history), [hero.type, hero.size, hero.repoArea, hero.team, hero.developer, history]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const steps = useMemo(() => buildSteps(HERO_SCENARIO, est.quote, est.areaRisk, choice), [est, choice]);
  const blocked = idx > 0 && steps[idx - 1].kind === 'prompt' && !choice;
  const done = idx >= steps.length && steps[steps.length - 1].kind === 'receipt';
  const receipt = useMemo(() => (choice ? computeReceipt(HERO_SCENARIO, est.quote, choice, hero.capability, hero.prNumber) : null), [choice, est, hero.capability, hero.prNumber]);

  const stepsLen = useRef(steps.length);
  stepsLen.current = steps.length;
  const advance = () => setIdx((i) => Math.min(i + 1, stepsLen.current));

  useEffect(() => {
    if (!playing || blocked || done) return;
    const id = setInterval(advance, TICK_MS);
    return () => clearInterval(id);
  }, [playing, blocked, done]);

  useEffect(() => {
    if (done && receipt && state.heroReceipt?.choice !== receipt.choice) dispatch({ kind: 'completeHero', receipt });
  }, [done, receipt, state.heroReceipt, dispatch]);

  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight }); }, [idx]);

  const reset = () => {
    setPlaying(false);
    setIdx(0);
    setChoice(null);
    dispatch({ kind: 'resetHero', initial });
  };

  const visible = steps.slice(0, idx);
  const spend = visible.reduce((a, s) => a + s.cost, 0);
  const envelope = visible.length ? visible[visible.length - 1].envelope : est.quote.high;
  const currentItem = HERO_SCENARIO.items.find((it) => it.key === [...visible].reverse().find((s) => s.item)?.item)?.label;

  return (
    <>
      <section className="card">
        <div className="term-head">
          <h3>Engineer: {hero.developer}, {hero.team} <span className="pill warn">simulated session</span></h3>
          <div className="row tight">
            <button onClick={() => setPlaying(true)} disabled={playing || done}>Play</button>
            <button onClick={() => { setPlaying(false); advance(); }} disabled={blocked || done}>Step</button>
            <button onClick={reset}>Reset</button>
          </div>
        </div>
        <p className="muted">Scripted replay of a coding-agent session with synthetic data. The quote, detector flags and receipt are computed live.</p>
        <div className="terminal" ref={termRef}>
          {visible.length === 0 && <div className="t-dim">Press Play or Step to start the session.</div>}
          {visible.map((s, i) => (
            <div key={i} className={`t-${s.kind}${s.failed ? ' t-fail' : ''}`}>
              {s.kind === 'user' && <span className="t-dim">&gt; </span>}
              {s.kind === 'event' && <span className="t-dim">{usd(s.cost).padStart(6)} {tok(s.cost).replace(' tokens', '').padStart(4)}  </span>}
              {s.text}
            </div>
          ))}
          {blocked && (
            <div className="t-choices">
              {(['surface', 'platform'] as Choice[]).map((c, n) => (
                <button key={c} onClick={() => { setChoice(c); setIdx((i) => i + 1); }}>
                  [{n + 1}] {HERO_SCENARIO.tradeoff.options[c].label}: +{usd(optionCost(HERO_SCENARIO, c))}
                  <span className="t-dim"> · {HERO_SCENARIO.tradeoff.options[c].detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`statusline${spend > envelope ? ' over' : ''}`}>
          <span>spend {usd(spend)} ({tok(spend)}) / envelope {usd(envelope)}</span>
          <span>{currentItem ? `item: ${currentItem}` : 'planning'}</span>
          <span>{done ? 'complete' : blocked ? 'waiting for your choice' : playing ? 'running' : 'paused'}</span>
        </div>
        {done && receipt && (
          <div className="receipt">
            <h4>Receipt</h4>
            <div className="quote">
              <span className="big">{usd(receipt.actual)}</span>
              <span className="muted">{tok(receipt.actual)}</span>
              <span className="muted">vs quote {usd(receipt.quote.low)} – {usd(receipt.quote.high)}</span>
              <span className={receipt.withinQuote ? 'pill ok' : 'pill bad'}>{receipt.withinQuote ? 'within quote' : 'outside quote'}</span>
            </div>
            <ul>{receipt.variance.map((v) => <li key={v}>{v}</li>)}</ul>
            <p><b>Capability delivered:</b> {receipt.capability} · <b>PR #{receipt.prNumber}</b> merged (simulated) · task <TaskLink id={hero.id} /> written to the shared store.</p>
          </div>
        )}
      </section>
      <DetectorPanel />
      <TryItPanel />
    </>
  );
}
