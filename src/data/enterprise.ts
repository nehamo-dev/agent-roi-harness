// Org-scale capability aggregates (synthetic), modeled on ~3,000 engineers at ~$250 per developer per month.
// Every modeled run is drawn from the same per-run distribution as the task history (sampleRunCost),
// so the heavy tail is preserved. The 150 sampled tasks in the store are added on top in the selectors.
import { makeRng } from '../core/rng';
import type { CapabilityAggregate } from '../core/types';
import { CAPABILITY_CATALOG, runawayCost, sampleRunCost } from './generate';
import { OWNER_NOTES } from './ownerNotes';

export const ORG_ENGINEERS = 3000;
export const SPEND_PER_DEV_MONTH = 250;
export const QUARTER_MONTHS = 3;
export const QUARTER_WEEKS = 13;
const TARGET_SPEND = ORG_ENGINEERS * SPEND_PER_DEV_MONTH * QUARTER_MONTHS;

// Actual work as a share of the work the budget was planned for. Over-budget capabilities are named;
// the rest draw from 0.64-0.86 so they land at roughly 60-90% of budget.
const OVER: Record<string, { ratio: number; inProgress?: boolean; incident?: { week: number; shareOfBudget: number } }> = {
  'mTLS between services': { ratio: 1.24, inProgress: true },
  'Refund status API': { ratio: 0.97, incident: { week: 6, shareOfBudget: 0.33 } },
  'SCIM user provisioning': { ratio: 1.3 },
  'Event pipeline backfill': { ratio: 1.17 },
};
const PLANNED_IN_PROGRESS = new Set(['Instant payouts']);

export function generateEnterprise(seed = 9001): CapabilityAggregate[] {
  const rng = makeRng(seed);
  const pilot = makeRng(seed + 1);
  const teamMean: Record<string, number> = {};
  for (const team of new Set(CAPABILITY_CATALOG.map((c) => c.team))) {
    let s = 0;
    for (let i = 0; i < 20000; i++) s += sampleRunCost(pilot, team);
    teamMean[team] = s / 20000;
  }
  const weights = CAPABILITY_CATALOG.map(() => 0.5 + rng());
  const wSum = weights.reduce((a, b) => a + b, 0);

  return CAPABILITY_CATALOG.map((c, idx) => {
    const over = OVER[c.capability];
    const ratio = over ? over.ratio : 0.64 + rng() * 0.22;
    const spendTarget = (TARGET_SPEND * weights[idx]) / wSum;
    const runs = Math.round(spendTarget / teamMean[c.team]);
    const budget = Math.round(((runs / ratio) * teamMean[c.team]) / 1000) * 1000;
    const inProgress = over?.inProgress || PLANNED_IN_PROGRESS.has(c.capability);
    // Org spend is steady week to week: each capability's work spreads across the whole quarter.
    const start = 0;
    const end = QUARTER_WEEKS - 1;
    const weekly = new Array(QUARTER_WEEKS).fill(0);
    const oneOffWeekly = new Array(QUARTER_WEEKS).fill(0);
    let spend = 0;
    for (let i = 0; i < runs; i++) {
      const cost = sampleRunCost(rng, c.team);
      weekly[start + Math.floor(rng() * (end - start + 1))] += cost;
      spend += cost;
    }
    let extraRuns = 0;
    if (over?.incident) {
      // A burst of runs from the far tail in one week: the same runaway cost draw, concentrated.
      let burst = 0;
      while (burst < over.incident.shareOfBudget * budget) {
        const cost = runawayCost(rng);
        burst += cost;
        extraRuns++;
      }
      weekly[over.incident.week] += burst;
      oneOffWeekly[over.incident.week] += burst;
      spend += burst;
    }
    return {
      ...c, budget, modeledSpend: spend, modeledRuns: runs + extraRuns, weekly, oneOffWeekly,
      plannedStatus: inProgress ? 'in progress' : 'delivered', note: OWNER_NOTES[c.capability] ?? null,
    };
  });
}
