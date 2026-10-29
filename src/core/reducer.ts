// Shared demo state. Pure reducer so scripts can replay the same actions the UI dispatches.
import type { DecisionOption } from './decision';
import type { Receipt } from './session';
import type { CapabilityAggregate, Justified, Task } from './types';

export interface DemoState {
  tasks: Task[];
  capabilities: CapabilityAggregate[];
  heroReceipt: Receipt | null;
  pausedDecision: DecisionOption | null;
}

export type Action =
  | { kind: 'tag'; taskId: string; justified: Justified }
  | { kind: 'completeHero'; receipt: Receipt }
  | { kind: 'resolvePaused'; option: DecisionOption }
  | { kind: 'resetHero'; initial: DemoState }
  | { kind: 'reset'; initial: DemoState };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.kind) {
    case 'tag':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, justified: action.justified } : t)) };
    case 'completeHero': {
      const r = action.receipt;
      return {
        ...state,
        heroReceipt: r,
        tasks: state.tasks.map((t) => (t.role === 'hero'
          ? { ...t, status: 'completed', actualCost: round2(r.actual), quote: { low: round2(r.quote.low), high: round2(r.quote.high) } }
          : t)),
      };
    }
    case 'resolvePaused': {
      const o = action.option;
      return {
        ...state,
        pausedDecision: o,
        tasks: state.tasks.map((t) => (t.role === 'paused-decision'
          ? { ...t, status: 'completed', actualCost: round2(o.finalCost), delivered: o.delivered, justified: o.delivered ? t.justified : 'no' }
          : t)),
      };
    }
    case 'resetHero': {
      const hero = action.initial.tasks.find((t) => t.role === 'hero')!;
      return { ...state, heroReceipt: null, tasks: state.tasks.map((t) => (t.role === 'hero' ? hero : t)) };
    }
    case 'reset':
      return action.initial;
  }
}

export const completedTasks = (s: DemoState) => s.tasks.filter((t) => t.status === 'completed');
export const heroTask = (s: DemoState) => s.tasks.find((t) => t.role === 'hero')!;
// History the engineer quote is computed from: completed tasks, excluding the scripted demo tasks.
export const quoteHistory = (s: DemoState) => s.tasks.filter((t) => t.status === 'completed' && !t.role);
