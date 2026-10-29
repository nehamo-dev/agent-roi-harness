// Turns detector flags into what the harness did on its own, and the one decision it hands to a person.
import type { Flag } from './detector';
import type { EventLog } from './eventlog';

export interface AutoIntervention {
  title: string;
  what: string;
  action: string;
  saved: number;
}

export interface NeededChoice {
  key: 'fix' | 'skip';
  label: string;
  detail: string;
  cost: number; // estimated dollars to carry out this choice
}

export interface NeededDecision {
  subject: string;
  question: string;
  options: NeededChoice[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function interventions(log: EventLog, flags: Flag[]): { auto: AutoIntervention[]; decision: NeededDecision | null } {
  const auto = flags.map((f): AutoIntervention => (f.cls === 'retry-loop'
    ? { title: `Stopped a retry loop on \`${f.subject}\``, what: `It failed ${f.count} times with no code change in between.`, action: 'Paused retries and asked the agent to find the cause before running it again.', saved: f.dollarsSaved }
    : { title: `Stopped re-reading \`${f.subject}\``, what: `The agent read it ${f.count} times without changing it.`, action: 'Kept the file in context so the agent works from what it already has.', saved: f.dollarsSaved }));

  // A paused retry loop is the one place a person decides: fix the cause now, or set it aside.
  const loop = flags.find((f) => f.cls === 'retry-loop');
  if (!loop) return { auto, decision: null };
  const ev = log.events;
  const editCost = avg(ev.filter((e) => e.kind === 'edit').map((e) => e.costDelta));
  const runCost = avg(ev.filter((e) => e.cmd === loop.subject).map((e) => e.costDelta));
  return {
    auto,
    decision: {
      subject: loop.subject,
      question: `\`${loop.subject}\` keeps failing and retries are paused. How should the agent continue?`,
      options: [
        { key: 'fix', label: 'Diagnose and fix it now', detail: 'The agent reads the failure, changes the code, and re-runs once.', cost: editCost + runCost },
        { key: 'skip', label: 'Set it aside and keep going', detail: 'Mark it as known-failing, finish the rest of the task, and log a follow-up.', cost: 0 },
      ],
    },
  };
}
