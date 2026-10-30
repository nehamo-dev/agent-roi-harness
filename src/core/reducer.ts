// Shared demo state. Pure reducer so scripts can replay the same actions the UI dispatches.
import type { Q4Data } from '../data/q4';
import { PAUSED_SCENARIO } from '../data/pausedScenario';
import { runRate, type DecisionOption } from './decision';
import { HERO_QUOTE_MAX_WIDTH } from './session';
import type { CapabilityAggregate, Justified, Task } from './types';

export interface DemoState {
  tasks: Task[];
  capabilities: CapabilityAggregate[];
  q4: Q4Data;
  pausedDecision: DecisionOption | null;
  decidedBy: 'engineer' | 'leader' | null;
  heroEscalated: boolean;
}

export type Action =
  | { kind: 'tag'; taskId: string; justified: Justified }
  | { kind: 'heroPaused'; cost: number }
  | { kind: 'escalate' }
  | { kind: 'resolvePaused'; option: DecisionOption; by: 'engineer' | 'leader' }
  | { kind: 'resetHero'; initial: DemoState }
  | { kind: 'reset'; initial: DemoState };

const round2 = (n: number) => Math.round(n * 100) / 100;

// "Finish the planned scope" splits the rest into a new task, quoted at the run's own rate.
function followUpTask(state: DemoState, hero: Task): Task {
  const ctx = PAUSED_SCENARIO;
  const rest = ctx.discoveredUnits - ctx.plannedUnits;
  const high = runRate(hero, ctx) * rest;
  const n = state.tasks.length + 1;
  return {
    ...hero, id: `T-${String(n).padStart(3, '0')}`, prNumber: hero.prNumber + n, role: undefined, eventLogId: null, splitFrom: hero.id,
    status: 'running', actualCost: 0, justified: 'unset', delivered: undefined, date: hero.date,
    quote: { low: round2(high / HERO_QUOTE_MAX_WIDTH), high: round2(high) },
  };
}

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.kind) {
    case 'tag':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, justified: action.justified } : t)) };
    case 'heroPaused':
      return { ...state, tasks: state.tasks.map((t) => (t.role === 'hero' ? { ...t, status: 'paused', actualCost: round2(action.cost) } : t)) };
    case 'escalate':
      return { ...state, heroEscalated: true };
    case 'resolvePaused': {
      const o = action.option;
      const hero = heroTask(state);
      const tasks = state.tasks.map((t) => (t.role === 'hero'
        ? { ...t, status: 'completed' as const, actualCost: round2(o.finalCost), delivered: o.delivered, justified: o.delivered ? t.justified : 'no' as const }
        : t));
      return {
        ...state, pausedDecision: o, decidedBy: action.by,
        tasks: o.key === 'planned-only' ? [...tasks, followUpTask(state, hero)] : tasks,
      };
    }
    case 'resetHero': {
      const hero = heroTask(action.initial);
      const ids = new Set(action.initial.tasks.map((t) => t.id));
      return {
        ...state, pausedDecision: null, decidedBy: null, heroEscalated: false,
        tasks: state.tasks.filter((t) => ids.has(t.id)).map((t) => (t.role === 'hero' ? hero : t)),
      };
    }
    case 'reset':
      return action.initial;
  }
}

export const completedTasks = (s: DemoState) => s.tasks.filter((t) => t.status === 'completed');
export const heroTask = (s: DemoState) => s.tasks.find((t) => t.role === 'hero')!;
// The task created when the hero's remaining scope was split off, if any.
export const followUp = (s: DemoState) => s.tasks.find((t) => t.splitFrom === heroTask(s).id);
// History the estimator quotes from: completed tasks, excluding the scripted hero run.
export const quoteHistory = (s: DemoState) => s.tasks.filter((t) => t.status === 'completed' && !t.role);
