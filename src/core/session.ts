// The hero run T-149 as terminal steps. Pure; shared by the engineer view and the eval scripts.
import { detect, type Flag } from './detector';
import type { EventLog } from './eventlog';

export const AUTO_APPROVE_LIMIT = 20; // dollars per task (3.33M tokens at the synthetic rate)
export const HERO_QUOTE_MAX_WIDTH = 1.3; // the hero's committed quote: high at most 1.3x low

export interface StepSpec {
  kind: 'started' | 'corrected' | 'decision';
  end: number; // last event index of this step
  servicesDone: number;
}

export interface HeroScenario {
  ticket: string;
  title: string;
  summary: string;
  design: { name: string; share: number; text: string }[]; // "{planned}" is filled with the planned service count
  outOfScope: string;
  mainRisk: string;
  sidecarNote: string;
  causes: Record<string, string>; // retry-loop subject -> what the agent found
  firstService: string;
  log: EventLog;
  steps: StepSpec[];
}

export interface RunStep {
  kind: StepSpec['kind'];
  spentAfter: number; // dollars, running sum of the log
  servicesDone: number;
  flags: Flag[]; // detector findings in this step, each one a correction
}

export function runSteps(s: HeroScenario): RunStep[] {
  const flags = detect(s.log);
  let from = 0;
  return s.steps.map((st) => {
    const spentAfter = s.log.events.slice(0, st.end + 1).reduce((a, e) => a + e.costDelta, 0);
    const inStep = flags.filter((f) => f.detectedAt >= from && f.detectedAt <= st.end);
    from = st.end + 1;
    return { kind: st.kind, spentAfter, servicesDone: st.servicesDone, flags: inStep };
  });
}

// Spend the harness stopped on the way: every flagged repeat in the run.
export const wasteCaught = (s: HeroScenario) => detect(s.log).reduce((a, f) => a + f.dollarsSaved, 0);
