// Scripted context for the paused run (synthetic). Option costs are computed in core/decision.ts.
const PLANNED = 10;
const DISCOVERED = 14;

export const PAUSED_SCENARIO = {
  why: 'Spend crossed the approved envelope, so the harness paused the run and asked for a decision.',
  changed: `The plan assumed ${PLANNED} services needed mTLS. Discovery found ${DISCOVERED}, and certificate rotation needs a shared sidecar change.`,
  plannedUnits: PLANNED,
  discoveredUnits: DISCOVERED,
  doneUnits: 8, // across the capability
  runDoneUnits: 1, // migrated by this paused run; sets its cost per service
  unitLabel: 'services',
  cleanupCost: 1.5,
  // Owner's note for the CFO page, by state of the leader's decision.
  note: {
    cause: `Discovery found that ${DISCOVERED} services need encrypted service-to-service traffic, not the ${PLANNED} we planned, and certificate rotation needs a shared change.`,
    pending: 'Work is paused until engineering leadership decides how far to go; this is a one-time scope change, not a recurring cost.',
    continue: `Leadership approved finishing all ${DISCOVERED} services; this is a one-time scope change, not a recurring cost.`,
    'planned-only': `Leadership approved finishing the planned ${PLANNED} and moving the other ${DISCOVERED - PLANNED} to a separately budgeted project; it will not recur here.`,
    stop: 'Leadership stopped the work and reverted it, so this capability will not ship; it will not recur.',
  },
};
