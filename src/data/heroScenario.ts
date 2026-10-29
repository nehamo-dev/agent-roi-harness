// Scripted hero session (synthetic). Costs come from the event lists, not from this file.
import { HERO_BASE, HERO_FINISH, HERO_OPTIONS, stamp } from './logs';
import type { HeroScenario } from '../core/session';

export const HERO_SCENARIO: HeroScenario = {
  prompt: 'Add saved cards at checkout so returning customers can pay in one click.',
  design: [
    'Store vaulted card references in CardVault (no raw card numbers), expose GET/POST /checkout/saved-cards.',
    'Check card-vault and PCI rules; benchmark checkout latency before and after.',
    'Build SavedCards UI in the checkout form; extend tests, including the ledger capture path.',
  ],
  items: [
    { key: 'services', label: 'Services (CardVault, checkout API)', share: 0.25, start: 0, end: 4 },
    { key: 'security', label: 'Security and performance exploration', share: 0.2, start: 5, end: 9 },
    { key: 'coding', label: 'Coding (UI, tests, PR)', share: 0.55, start: 10, end: 20 },
  ],
  baseLog: { id: 'hero', title: 'Hero session', events: stamp(HERO_BASE) },
  tradeoff: {
    question: 'The duplicate-charge bug is in LedgerClient.capture, which is shared with Payouts. How deep should I go?',
    options: {
      surface: {
        label: 'Surface fix',
        detail: 'Guard double-submit in SavedCards.tsx only. Ledger stays non-idempotent.',
        followUp: 'Platform debt remains in LedgerClient.capture; logged as a follow-up.',
        events: stamp(HERO_OPTIONS.surface, 21 * 23),
      },
      platform: {
        label: 'Deeper platform fix',
        detail: 'Make LedgerClient.capture idempotent with tests. Also unblocks "Retry-safe payment capture".',
        followUp: 'Also unblocks capability "Retry-safe payment capture" (Checkout reliability).',
        events: stamp(HERO_OPTIONS.platform, 21 * 23),
      },
    },
  },
  finish: stamp(HERO_FINISH, 28 * 23),
};
