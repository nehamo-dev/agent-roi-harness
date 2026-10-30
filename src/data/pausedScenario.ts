// Scope context for the hero run T-149 (synthetic). Option costs are computed in core/decision.ts.
const PLANNED = 6;
const DISCOVERED = 14;

export const PAUSED_SCENARIO = {
  why: 'Spend crossed the approved ceiling and the remaining work was a different size than planned, so the harness paused the run.',
  changed: `The plan assumed ${PLANNED} services needed mTLS. Discovery found ${DISCOVERED}, and certificate rotation needs a shared sidecar change.`,
  plannedUnits: PLANNED,
  discoveredUnits: DISCOVERED,
  doneUnits: 5, // services finished when the run paused
  runDoneUnits: 5, // the hero run did all of them; sets its cost per service
  unitLabel: 'services',
  cleanupCost: 1.5,
  // Owner's note for the CFO page, by state of the decision.
  note: {
    cause: `Discovery found that ${DISCOVERED} services need encrypted service-to-service traffic, not the ${PLANNED} we planned, and certificate rotation needs a shared change.`,
    pending: 'Work is paused until a decision is made on how far to go; this is a one-time scope change, not a recurring cost.',
    continue: `Leadership approved finishing all ${DISCOVERED} services; this is a one-time scope change, not a recurring cost.`,
    'planned-only': `The team finished the planned ${PLANNED} and moved the other ${DISCOVERED - PLANNED} to a separately quoted task; it will not recur here.`,
    stop: 'The team stopped the work and reverted it, so this capability will not ship; it will not recur.',
  },
};
