import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab } from '../tabs';

// What a step's setup can do: drive the real UI through its own buttons, and wait for it to react.
export interface TourCtx {
  click: (name: string) => void;
  waitFor: (selector: string, timeoutMs?: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}

export interface TourStep {
  persona: Tab;
  targets: string[]; // data-tour names; the spotlight covers all of them
  title: string;
  body: string;
  next?: string; // label for the Next button when it triggers an action
  before?: (c: TourCtx) => Promise<void>;
}

const sel = (name: string) => `[data-tour="${name}"]`;
const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const find = (s: string) => [...document.querySelectorAll(s)].find(visible);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// True when an element is fully visible in the viewport and in every scrolling ancestor.
function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) return r.height > window.innerHeight; // taller than the screen: leave it
  for (let p = el.parentElement; p; p = p.parentElement) {
    const pr = p.getBoundingClientRect();
    if (p.scrollHeight > p.clientHeight + 1 && (r.top < pr.top - 1 || r.bottom > pr.bottom + 1)) return r.height > pr.height;
  }
  return true;
}

const ctx: TourCtx = {
  sleep,
  click: (name) => (find(sel(name)) as HTMLElement | undefined)?.click(),
  waitFor: async (selector, timeoutMs = 10000) => {
    const css = selector.startsWith('[') || selector.includes(' ') ? selector : sel(selector);
    const end = Date.now() + timeoutMs;
    while (!find(css) && Date.now() < end) await sleep(100);
  },
};

interface Box { top: number; left: number; width: number; height: number }
const PAD = 8;
const CARD_W = 360;

export function Tour({ steps, setTab, onExit, onReplay }: { steps: TourStep[]; setTab: (t: Tab) => void; onExit: () => void; onReplay: () => void }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(true);
  const [box, setBox] = useState<Box | null>(null);
  const ranUpTo = useRef(-1);
  const step = steps[i];
  const last = i === steps.length - 1;

  // Enter a step: switch tab, run its setup once (going forward only), bring it into view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setTab(step.persona);
      await sleep(120);
      if (step.before && ranUpTo.current < i) await step.before(ctx);
      ranUpTo.current = Math.max(ranUpTo.current, i);
      if (cancelled) return;
      find(sel(step.targets[0]))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(350);
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [i, step, setTab]);

  // Follow the targets as the page scrolls and the run updates; if a target slips out of view
  // (page or an inner panel), bring it back.
  useEffect(() => {
    const measure = () => {
      const first = find(sel(step.targets[0]));
      if (first && !busy && !inView(first)) first.scrollIntoView({ block: 'nearest' });
      const rects = step.targets.map((t) => find(sel(t))?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      if (!rects.length) return setBox(null);
      const top = Math.min(...rects.map((r) => r.top));
      const left = Math.min(...rects.map((r) => r.left));
      setBox({ top, left, width: Math.max(...rects.map((r) => r.right)) - left, height: Math.max(...rects.map((r) => r.bottom)) - top });
    };
    measure();
    const id = setInterval(measure, 120);
    return () => clearInterval(id);
  }, [step, busy]);

  // The overlay blocks clicks, not scrolling: pass the wheel to whatever scrolls under the pointer.
  const onWheel = (e: React.WheelEvent) => {
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => !el.closest('.tour'));
    let el: Element | null = under ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    (el ?? document.scrollingElement)?.scrollBy({ top: e.deltaY, left: e.deltaX });
  };

  const next = useCallback(() => { if (!busy && !last) setI((n) => n + 1); }, [busy, last]);
  const back = useCallback(() => { if (!busy && i > 0) setI((n) => n - 1); }, [busy, i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onExit]);

  // Card goes below the spotlight, else above, else beside it, else inside its bottom-right corner.
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const cardH = 230;
  const GAP = PAD + 12;
  let top = vh - cardH - 16;
  let left = vw - CARD_W - 24;
  if (box) {
    const midTop = Math.min(Math.max(box.top, 16), vh - cardH - 16);
    left = Math.min(Math.max(box.left, 16), vw - CARD_W - 16);
    if (box.top + box.height + GAP + cardH < vh) top = box.top + box.height + GAP;
    else if (box.top - GAP - cardH > 0) top = box.top - GAP - cardH;
    else if (box.left - GAP - CARD_W > 0) { top = midTop; left = box.left - GAP - CARD_W; }
    else if (box.left + box.width + GAP + CARD_W < vw) { top = midTop; left = box.left + box.width + GAP; }
    else left = Math.min(box.left + box.width - CARD_W - 16, vw - CARD_W - 16);
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Guided demo">
      <div className="tour-block" onWheel={onWheel} />
      {box && <div className="tour-spot" style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} />}
      {!busy && (
        <div className="tour-card" style={{ top, left, width: CARD_W }}>
          <div className="tour-meta"><span>{step.persona}</span><span>{i + 1} / {steps.length}</span></div>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          <div className="tour-actions">
            <button className="link" onClick={onExit}>Exit</button>
            <span>
              {i > 0 && <button onClick={back}>Back</button>}
              {last
                ? <><button onClick={onExit}>Explore on your own</button><button className="btn-primary" onClick={onReplay}>Replay demo</button></>
                : <button className="btn-primary" onClick={next}>{step.next ?? 'Next →'}</button>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
