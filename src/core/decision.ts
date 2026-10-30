// Decision options for the paused run. Remaining cost uses the run's own observed run-rate.
import type { Task } from './types';

export type DecisionKey = 'continue' | 'planned-only' | 'stop';

export interface PausedContext {
  plannedUnits: number;
  discoveredUnits: number;
  doneUnits: number;
  runDoneUnits: number;
  unitLabel: string;
  cleanupCost: number;
}

export interface DecisionOption {
  key: DecisionKey;
  label: string;
  detail: string;
  addedCost: number;
  finalCost: number;
  delivered: boolean;
}

export function decisionOptions(task: Task, ctx: PausedContext): DecisionOption[] {
  // This run's own cost per service so far prices the remaining scope.
  const rate = task.actualCost / ctx.runDoneUnits;
  const mk = (key: DecisionKey, label: string, detail: string, addedCost: number, delivered: boolean): DecisionOption => ({
    key, label, detail, addedCost, finalCost: task.actualCost + addedCost, delivered,
  });
  return [
    mk('continue', `Do all ${ctx.discoveredUnits} ${ctx.unitLabel}`,
      'Finish the whole job at the rate seen so far.',
      rate * (ctx.discoveredUnits - ctx.doneUnits), true),
    mk('planned-only', `Finish the ${ctx.plannedUnits} planned, re-quote the rest`,
      `Ship the original scope. The other ${ctx.discoveredUnits - ctx.plannedUnits} become a new task with its own quote.`,
      rate * (ctx.plannedUnits - ctx.doneUnits), true),
    mk('stop', 'Stop and revert',
      'Undo the partial changes. Nothing ships, and the capability is not delivered this period.',
      ctx.cleanupCost, false),
  ];
}

// Cost per unit the run has shown so far.
export const runRate = (task: Task, ctx: PausedContext) => task.actualCost / ctx.runDoneUnits;
