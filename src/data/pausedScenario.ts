// Scripted context for the paused run (synthetic). Option costs are computed in core/decision.ts.
export const PAUSED_SCENARIO = {
  why: 'Spend crossed the approved envelope, so the harness paused the run and asked for a decision.',
  changed: 'The plan assumed 6 services needed mTLS. Discovery found 14, and certificate rotation needs a shared sidecar change.',
  plannedUnits: 6,
  discoveredUnits: 14,
  doneUnits: 5,
  unitLabel: 'services',
  cleanupCost: 1.5,
  // Owner's note for the CFO page, by state of the leader's decision.
  note: {
    cause: 'Discovery found that 14 services need encrypted service-to-service traffic, not the 6 we planned, and certificate rotation needs a shared change.',
    pending: 'Work is paused until engineering leadership decides how far to go; this is a one-time scope change, not a recurring cost.',
    continue: 'Leadership approved finishing all 14 services this quarter; this is a one-time scope change, not a recurring cost.',
    'planned-only': 'Leadership approved finishing the planned 6 and moving the other 8 to a separately budgeted project; it will not recur here.',
    stop: 'Leadership stopped the work and reverted it, so this capability will not ship this quarter; it will not recur.',
  },
};
