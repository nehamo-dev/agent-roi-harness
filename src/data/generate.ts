// Synthetic data generator. Cost parameters live only in this file; the estimator never imports them.
import { makeRng, normal, pick } from '../core/rng';
import type { Justified, RepoArea, Size, Task, TaskType } from '../core/types';
import { TASK_TYPES } from '../core/types';

export const SEED = 20260701;
export const START_DATE = '2026-07-01';
export const END_DATE = '2026-09-30';
export const TEST_START = '2026-09-01';

const BASE_COST: Record<TaskType, number> = {
  feature: 7, bugfix: 3, refactor: 5.5, migration: 9, tests: 2.5, infra: 5,
};
const SIZE_MULT: Record<Size, number> = { S: 0.5, M: 1, L: 2.2 };
const AREA_MULT: Record<RepoArea, number> = {
  payments: 1.3, auth: 1.15, 'web-frontend': 0.85, 'data-pipeline': 1.1, platform: 1.2,
};
const NOISE_SIGMA = 0.45;

interface TeamDef {
  team: string;
  home: RepoArea;
  developers: string[];
  initiatives: { name: string; capabilities: string[] }[];
}

const TEAMS: TeamDef[] = [
  {
    team: 'Payments', home: 'payments', developers: ['Ana R.', 'Ben K.', 'Chen L.', 'Dee M.'],
    initiatives: [
      { name: 'Checkout reliability', capabilities: ['Saved cards at checkout', 'Retry-safe payment capture', 'Refund status API'] },
      { name: 'Payouts v2', capabilities: ['Instant payouts', 'Payout reconciliation report'] },
    ],
  },
  {
    team: 'Identity', home: 'auth', developers: ['Eli N.', 'Fay O.', 'Gus P.'],
    initiatives: [
      { name: 'SSO for enterprise', capabilities: ['SAML login', 'SCIM user provisioning'] },
      { name: 'Account security', capabilities: ['Passkey sign-in', 'Session revocation'] },
    ],
  },
  {
    team: 'Growth', home: 'web-frontend', developers: ['Hal Q.', 'Ivy R.', 'Jo S.', 'Kai T.'],
    initiatives: [
      { name: 'Onboarding funnel', capabilities: ['Guided setup wizard', 'Trial-to-paid prompt'] },
      { name: 'Pricing page refresh', capabilities: ['Plan comparison table', 'Usage-based price calculator'] },
    ],
  },
  {
    team: 'Platform', home: 'platform', developers: ['Lu V.', 'Max W.', 'Nia X.'],
    initiatives: [
      { name: 'Data platform', capabilities: ['Event pipeline backfill', 'Warehouse cost dashboard'] },
      { name: 'Service mesh', capabilities: ['mTLS between services', 'Shared rate limiter'] },
    ],
  },
];

const OTHER_AREAS: RepoArea[] = ['payments', 'auth', 'web-frontend', 'data-pipeline', 'platform'];

function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  while (d <= e) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface GeneratedData {
  tasks: Task[]; // quotes are empty here; dataset.ts attaches them
}

// One run drawn from the same per-run distribution as the task history, for a given team.
// Used by the org-scale aggregates so capability totals share the history's shape and tail.
export const RUNAWAY_P = 0.027;
export function sampleRunCost(rng: () => number, teamName: string): number {
  const team = TEAMS.find((t) => t.team === teamName)!;
  if (rng() < RUNAWAY_P) return runawayCost(rng);
  const type = pick(rng, TASK_TYPES);
  const r = rng();
  const size: Size = r < 0.4 ? 'S' : r < 0.82 ? 'M' : 'L';
  const repoArea = rng() < 0.7 ? team.home : pick(rng, OTHER_AREAS);
  return BASE_COST[type] * SIZE_MULT[size] * AREA_MULT[repoArea] * Math.exp(normal(rng) * 0.2) * Math.exp(normal(rng) * NOISE_SIGMA);
}
export const runawayCost = (rng: () => number) => 100 + rng() * 200;

// Engineering manager per team (synthetic).
export const TEAM_EM: Record<string, string> = { Payments: 'Ravi S.', Identity: 'Lena K.', Growth: 'Omar D.', Platform: 'Mia T.' };

export const CAPABILITY_CATALOG = TEAMS.flatMap((t) => t.initiatives.flatMap((i) => i.capabilities.map((capability) => ({ capability, initiative: i.name, team: t.team }))));

export function generate(seed = SEED, count = 148): GeneratedData {
  const rng = makeRng(seed);
  const days = weekdaysBetween(START_DATE, END_DATE).filter((d) => d < '2026-09-29');
  const devFactor: Record<string, number> = {};
  for (const t of TEAMS) for (const d of t.developers) devFactor[d] = Math.exp(normal(rng) * 0.2);

  const raw: Omit<Task, 'id' | 'prNumber'>[] = [];
  for (let i = 0; i < count; i++) {
    const team = TEAMS[Math.floor(rng() * TEAMS.length)];
    const init = pick(rng, team.initiatives);
    const type = pick(rng, TASK_TYPES);
    const r = rng();
    const size: Size = r < 0.4 ? 'S' : r < 0.82 ? 'M' : 'L';
    const repoArea = rng() < 0.7 ? team.home : pick(rng, OTHER_AREAS);
    const developer = pick(rng, team.developers);
    const cost = BASE_COST[type] * SIZE_MULT[size] * AREA_MULT[repoArea] * devFactor[developer] * Math.exp(normal(rng) * NOISE_SIGMA);
    raw.push({
      team: team.team, developer, initiative: init.name, capability: pick(rng, init.capabilities),
      type, size, repoArea, quote: { low: 0, high: 0 }, actualCost: cost, eventLogId: null,
      status: 'completed', justified: 'unset', date: pick(rng, days),
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Heavy tail: a few runaway runs spread across the quarter.
  for (const idx of [19, 58, 101, 133]) raw[idx].actualCost = runawayCost(rng);

  // Tagging lags: the most recent ~40 completed tasks stay unset.
  const tagCutoff = raw.length - 40;
  raw.forEach((t, i) => {
    if (i < tagCutoff) t.justified = (rng() < (t.actualCost > 100 ? 0.4 : 0.82) ? 'yes' : 'no') as Justified;
  });

  // The hero run T-149: plays live in the engineer view; its cost is written as the run progresses.
  raw.push({
    team: 'Platform', developer: 'Max W.', initiative: 'Service mesh', capability: 'mTLS between services',
    type: 'migration', size: 'L', repoArea: 'platform', quote: { low: 0, high: 0 }, actualCost: 0,
    eventLogId: 'hero', status: 'running', justified: 'unset', date: '2026-09-29', role: 'hero',
  });
  // An ordinary recent task (formerly the scripted checkout run).
  raw.push({
    team: 'Payments', developer: 'Ana R.', initiative: 'Checkout reliability', capability: 'Saved cards at checkout',
    type: 'feature', size: 'M', repoArea: 'payments', quote: { low: 0, high: 0 }, actualCost: 10.48,
    eventLogId: null, status: 'completed', justified: 'unset', date: '2026-09-30',
  });

  const tasks: Task[] = raw.map((t, i) => ({
    ...t,
    id: `T-${String(i + 1).padStart(3, '0')}`,
    prNumber: 4100 + i,
    actualCost: Math.round(t.actualCost * 100) / 100,
  }));

  return { tasks };
}
