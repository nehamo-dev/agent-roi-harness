// Scripted hero run T-149 (synthetic). Costs and corrections are computed from the event log;
// the step boundaries and the scope discovery (6 planned, 14 found) are part of the script.
import type { HeroScenario } from '../core/session';
import { HERO_LOG, stamp } from './logs';

export const HERO_SCENARIO: HeroScenario = {
  ticket: 'PLAT-2417',
  title: 'Require mTLS between internal services',
  summary: 'Today our services call each other without proving who they are. This task makes every service-to-service call use mutual TLS, so each side checks the other’s certificate. It touches core infrastructure, so a mistake is expensive.',
  // Each design item with a short name and its planned share of the quote (shares sum to 1).
  design: [
    { name: 'Service certificates', share: 0.15, text: 'Each service gets its own certificate from the internal certificate authority, so it can prove who it is.' },
    { name: 'Mutual TLS on every call', share: 0.2, text: 'Every service-to-service call switches to mutual TLS: both sides check the other’s certificate before any data moves.' },
    { name: 'Shared library + {planned} services', share: 0.4, text: 'The change goes into the shared client library, then each of the {planned} services listed in the ticket is updated and tested one at a time.' },
    { name: 'Automatic rotation', share: 0.15, text: 'Certificates rotate automatically every 24 hours, with no downtime and no manual steps.' },
    { name: 'Flagged rollout', share: 0.1, text: 'Rolled out service by service behind a flag, so any one service can be switched back without affecting the rest.' },
  ],
  outOfScope: 'Out of scope: traffic from outside the company and customer sign-in. The quote covers only the {planned} listed services.',
  mainRisk: 'Main risk: certificate rotation can force changes in services nobody expected.',
  sidecarNote: 'rotating certificates needs a shared sidecar change too',
  // What the agent found once the harness stopped each retry loop.
  causes: {
    'npm test auth-integration': 'a stale certificate in the test setup',
    'kubectl rollout status deploy/search': 'the sidecar was still serving the old certificate',
  },
  firstService: 'auth-service',
  log: { id: 'hero', title: 'Hero session (mTLS between services)', events: stamp(HERO_LOG) },
  steps: [
    { kind: 'started', end: 8, servicesDone: 1 },
    { kind: 'corrected', end: 15, servicesDone: 2 },
    { kind: 'corrected', end: 22, servicesDone: 3 },
    { kind: 'decision', end: 34, servicesDone: 5 },
  ],
};
