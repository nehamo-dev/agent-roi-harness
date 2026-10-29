export const TASK_TYPES = ['feature', 'bugfix', 'refactor', 'migration', 'tests', 'infra'] as const;
export const SIZES = ['S', 'M', 'L'] as const;
export const REPO_AREAS = ['payments', 'auth', 'web-frontend', 'data-pipeline', 'platform'] as const;

export type TaskType = (typeof TASK_TYPES)[number];
export type Size = (typeof SIZES)[number];
export type RepoArea = (typeof REPO_AREAS)[number];
export type Status = 'completed' | 'paused' | 'running';
export type Justified = 'yes' | 'no' | 'unset';

export interface Quote {
  low: number;
  high: number;
}

export interface Task {
  id: string;
  team: string;
  developer: string;
  initiative: string;
  capability: string;
  type: TaskType;
  size: Size;
  repoArea: RepoArea;
  quote: Quote;
  actualCost: number;
  eventLogId: string | null;
  status: Status;
  justified: Justified;
  prNumber: number;
  date: string; // YYYY-MM-DD
  role?: 'hero' | 'paused-decision';
  delivered?: boolean; // false when a run was stopped without shipping its capability
}

export interface OwnerNote {
  text: string;
  recurs: 'yes' | 'no';
}

// Org-scale spend for one capability over the quarter (synthetic). The store's sampled tasks are added on top.
export interface CapabilityAggregate {
  capability: string;
  initiative: string;
  team: string;
  budget: number;
  modeledSpend: number;
  modeledRuns: number;
  weekly: number[]; // modeled spend per week of the quarter
  oneOffWeekly: number[]; // part of weekly that owners marked as one-off
  plannedStatus: 'delivered' | 'in progress';
  note: OwnerNote | null;
}

// Features the estimator is allowed to see. Never cost, never generator parameters.
export interface TaskFeatures {
  type: TaskType;
  size: Size;
  repoArea: RepoArea;
  team?: string;
  developer?: string;
}
