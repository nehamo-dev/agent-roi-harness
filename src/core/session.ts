// Turns the scripted hero session into terminal steps and a receipt. Pure; shared by UI and eval scripts.
import { detect, type Flag } from './detector';
import type { EventLog, LogEvent } from './eventlog';
import type { Quote } from './types';

export type Choice = 'surface' | 'platform';
export const AUTO_APPROVE_LIMIT = 25; // dollars per task

export interface TradeoffOption {
  label: string;
  detail: string;
  followUp: string;
  events: LogEvent[];
}

export interface HeroScenario {
  prompt: string;
  design: string[];
  items: { key: string; label: string; share: number; start: number; end: number }[];
  baseLog: EventLog;
  tradeoff: { question: string; options: Record<Choice, TradeoffOption> };
  finish: LogEvent[];
}

export type StepKind = 'user' | 'text' | 'plan' | 'approve' | 'event' | 'harness' | 'prompt' | 'receipt';
export interface Step {
  kind: StepKind;
  text: string;
  cost: number;
  envelope: number; // approved envelope after this step
  item?: string;
  failed?: boolean;
}

const sumCost = (ev: LogEvent[]) => ev.reduce((a, e) => a + e.costDelta, 0);
const money = (n: number) => `$${n.toFixed(2)}`;
export const optionCost = (s: HeroScenario, c: Choice) => sumCost(s.tradeoff.options[c].events);

export function planItems(s: HeroScenario, quote: Quote) {
  return s.items.map((it) => ({ ...it, low: quote.low * it.share, high: quote.high * it.share }));
}

function eventText(e: LogEvent): string {
  if (e.kind === 'read') return `Read ${e.file}`;
  if (e.kind === 'edit') return `Edit ${e.file}`;
  return `$ ${e.cmd}  ${e.exitCode === 0 ? '✓ passed' : `✗ exit ${e.exitCode}`}`;
}

const CORRECTION: Record<Flag['cls'], string> = {
  'retry-loop': 'Harness: stopped the loop and asked the agent to diagnose the failure before re-running.',
  'repeated-read': 'Harness: pinned the file in context; further reads of it are skipped.',
};

export function buildSteps(s: HeroScenario, quote: Quote, mainRisk: string, choice: Choice | null): Step[] {
  const steps: Step[] = [];
  let env = quote.high;
  const push = (kind: StepKind, text: string, cost = 0, extra: Partial<Step> = {}) => steps.push({ kind, text, cost, envelope: env, ...extra });

  push('user', s.prompt);
  push('text', 'Plan:');
  s.design.forEach((d) => push('text', `  • ${d}`));
  planItems(s, quote).forEach((p) => push('plan', `${p.label.padEnd(40)} ${money(p.low)} – ${money(p.high)}`));
  push('plan', `${'Total quote'.padEnd(40)} ${money(quote.low)} – ${money(quote.high)}`);
  push('text', `Main risk: ${mainRisk}`);
  if (quote.high <= AUTO_APPROVE_LIMIT) {
    push('approve', `Auto-approved: quote ceiling ${money(quote.high)} is under the ${money(AUTO_APPROVE_LIMIT)} per-task threshold. Envelope ${money(quote.high)}.`);
  } else {
    push('approve', `Quote ceiling ${money(quote.high)} exceeds the ${money(AUTO_APPROVE_LIMIT)} threshold; approval required.`);
  }

  const flags = detect(s.baseLog);
  s.baseLog.events.forEach((e, i) => {
    const item = s.items.find((it) => i >= it.start && i <= it.end)?.key;
    push('event', eventText(e), e.costDelta, { item, failed: (e.exitCode ?? 0) !== 0 });
    flags.filter((f) => f.detectedAt === i).forEach((f) => {
      push('harness', `Detector: ${f.message}`);
      push('harness', CORRECTION[f.cls]);
    });
  });

  const opts = s.tradeoff.options;
  push('prompt', `${s.tradeoff.question}  [1] ${opts.surface.label} +${money(optionCost(s, 'surface'))}   [2] ${opts.platform.label} +${money(optionCost(s, 'platform'))}`);
  if (!choice) return steps;

  env += optionCost(s, choice);
  push('approve', `Engineer chose: ${opts[choice].label}. Approved +${money(optionCost(s, choice))}; envelope now ${money(env)}.`);
  opts[choice].events.forEach((e) => push('event', eventText(e), e.costDelta, { item: 'coding', failed: (e.exitCode ?? 0) !== 0 }));
  s.finish.forEach((e) => push('event', eventText(e), e.costDelta, { item: 'coding' }));
  push('receipt', 'Run complete. Receipt below.');
  return steps;
}

export interface Receipt {
  choice: Choice;
  quote: Quote;
  actual: number;
  items: { label: string; low: number; high: number; actual: number }[];
  wasteCaught: number;
  tradeoffCost: number;
  variance: string[];
  capability: string;
  prNumber: number;
  withinQuote: boolean;
}

export function computeReceipt(s: HeroScenario, quote: Quote, choice: Choice, capability: string, prNumber: number): Receipt {
  const extra = [...s.tradeoff.options[choice].events, ...s.finish];
  const items = planItems(s, quote).map((p) => {
    let actual = sumCost(s.baseLog.events.slice(p.start, p.end + 1));
    if (p.key === 'coding') actual += sumCost(extra);
    return { label: p.label, low: p.low, high: p.high, actual };
  });
  const actual = items.reduce((a, i) => a + i.actual, 0);
  const wasteCaught = detect(s.baseLog).reduce((a, f) => a + f.dollarsSaved, 0);
  const tradeoffCost = optionCost(s, choice);
  const mid = Math.sqrt(quote.low * quote.high);
  const delta = (actual - mid) / mid;
  const variance = [
    `Actual ${money(actual)} vs quote ${money(quote.low)} – ${money(quote.high)} (${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}% vs midpoint ${money(mid)}).`,
    ...items.map((i) => `${i.label}: ${money(i.actual)} vs plan ${money(i.low)} – ${money(i.high)} (${i.actual > i.high ? 'over' : i.actual < i.low ? 'under' : 'within'}).`),
    `Trade-off: ${s.tradeoff.options[choice].label}, +${money(tradeoffCost)} approved mid-run. ${s.tradeoff.options[choice].followUp}`,
    `Waste caught by the harness: ${money(wasteCaught)} of repeat attempts and reads, stopped before it grew (included in actual).`,
  ];
  return { choice, quote, actual, items, wasteCaught, tradeoffCost, variance, capability, prNumber, withinQuote: actual >= quote.low && actual <= quote.high };
}
