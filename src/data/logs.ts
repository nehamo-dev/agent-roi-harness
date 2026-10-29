// Hand-authored sample event logs. Synthetic. Waste labels live separately in labels.ts.
import type { EventLog, LogEvent } from '../core/eventlog';

type E = Omit<LogEvent, 't'>;
const r = (file: string, costDelta = 0.06): E => ({ kind: 'read', file, costDelta });
const e = (file: string, costDelta = 0.45): E => ({ kind: 'edit', file, costDelta });
const c = (cmd: string, exitCode = 0, costDelta = 0.2): E => ({ kind: 'command', cmd, exitCode, costDelta });
const t = (cmd: string, exitCode = 0, costDelta = 0.28): E => ({ kind: 'test', cmd, exitCode, costDelta });

export function stamp(events: E[], startSec = 0): LogEvent[] {
  return events.map((ev, i) => {
    const s = startSec + i * 23;
    return { ...ev, t: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` };
  });
}
const log = (id: string, title: string, events: E[]): EventLog => ({ id, title, events: stamp(events) });

// Hero session: the base run up to the trade-off point. Segments index into this list.
export const HERO_BASE: E[] = [
  // services (0-4)
  r('services/cards/CardVault.ts'), r('services/cards/types.ts', 0.05), r('api/checkout/routes.ts', 0.07),
  e('services/cards/CardVault.ts', 0.55), e('api/checkout/routes.ts', 0.45),
  // security and performance exploration (5-9)
  r('docs/security/card-vault.md', 0.08), r('services/cards/CardVault.ts'), c('npm run audit:pci', 0, 0.35),
  t('npm run bench checkout', 0, 0.42), e('services/cards/CardVault.ts', 0.6),
  // coding (10-20)
  e('web/checkout/SavedCards.tsx', 0.7), e('web/checkout/CheckoutForm.tsx', 0.55),
  t('npm test checkout', 1), r('ledger/LedgerClient.ts', 0.07), t('npm test checkout', 1),
  r('ledger/LedgerClient.ts', 0.07), r('ledger/LedgerClient.ts', 0.07), t('npm test checkout', 1),
  e('tests/ledger/LedgerClient.test.ts', 0.45), e('web/checkout/SavedCards.tsx', 0.35), t('npm test checkout', 0, 0.3),
];
export const HERO_OPTIONS: Record<'surface' | 'platform', E[]> = {
  surface: [e('web/checkout/SavedCards.tsx', 0.4), t('npm test checkout', 0, 0.3)],
  platform: [
    e('ledger/LedgerClient.ts', 1.4), e('ledger/idempotency.ts', 1.1), e('tests/ledger/LedgerClient.test.ts', 0.6),
    t('npm test ledger', 0, 0.45), t('npm test checkout', 0, 0.3), t('npm run bench checkout', 0, 0.42),
  ],
};
export const HERO_FINISH: E[] = [c('gh pr create --fill', 0, 0.12)];

export const SAMPLE_LOGS: EventLog[] = [
  log('clean-1', 'Clean: small bugfix', [
    r('src/date/format.ts'), r('src/date/format.test.ts'), e('src/date/format.ts'), t('npm test date'),
  ]),
  log('clean-2', 'Clean: fix with one failing test', [
    r('api/users/handler.ts'), r('api/users/schema.ts'), e('api/users/handler.ts'), t('npm test users', 1),
    e('api/users/handler.ts', 0.3), t('npm test users'), c('npm run build'),
  ]),
  log('tricky-reread', 'Tricky: re-reads after each edit (legitimate)', [
    r('config/flags.ts'), e('config/flags.ts'), r('config/flags.ts'), e('config/flags.ts'),
    r('config/flags.ts'), t('npm test flags'),
  ]),
  log('tricky-rerun', 'Tricky: test re-run after each fix (legitimate)', [
    r('search/index.ts'), t('npm test search', 1), e('search/index.ts'), t('npm test search', 1),
    e('search/ranker.ts'), t('npm test search'),
  ]),
  log('tricky-mixed-cmds', 'Tricky: different failing commands, two reads', [
    r('infra/main.tf'), c('terraform validate', 1), r('infra/vars.tf'), c('terraform fmt -check', 1),
    r('infra/main.tf'), e('infra/main.tf'), c('terraform validate'),
  ]),
  log('retry-1', 'Retry loop: same failing test, no changes', [
    r('billing/invoice.ts'), e('billing/invoice.ts'), t('npm test billing', 1), t('npm test billing', 1),
    t('npm test billing', 1), t('npm test billing', 1), r('billing/invoice.test.ts'), e('billing/invoice.ts'),
    t('npm test billing'),
  ]),
  log('retry-2', 'Retry loop: migration command', [
    r('db/migrations/042_add_index.sql'), c('npm run migrate', 1, 0.3), r('db/logs/migrate.log', 0.04),
    c('npm run migrate', 1, 0.3), c('npm run migrate', 1, 0.3), e('db/migrations/042_add_index.sql'),
    c('npm run migrate', 0, 0.3),
  ]),
  log('reads-1', 'Repeated reads: config file', [
    r('app/config.ts'), r('app/server.ts'), r('app/config.ts'), r('app/routes.ts'), r('app/config.ts'),
    r('app/config.ts'), e('app/routes.ts'), t('npm test app'),
  ]),
  log('reads-2', 'Repeated reads: schema while editing other files', [
    r('db/schema.sql'), e('api/orders.ts'), r('db/schema.sql'), e('api/orders.test.ts'), r('db/schema.sql'),
    t('npm test orders'),
  ]),
  log('mixed-1', 'Mixed: repeated reads and a retry loop', [
    r('notify/email.ts'), r('notify/templates.ts'), e('notify/email.ts'), t('npm test notify', 1),
    r('notify/templates.ts'), t('npm test notify', 1), r('notify/templates.ts'), t('npm test notify', 1),
    r('notify/templates.ts'), e('notify/templates.ts'), t('npm test notify'),
  ]),
  log('mixed-2', 'Mixed: lint retry and repeated reads', [
    r('ui/Button.tsx'), e('ui/Button.tsx'), c('npm run lint', 1, 0.15), c('npm run lint', 1, 0.15),
    r('ui/theme.ts'), c('npm run lint', 1, 0.15), r('ui/theme.ts'), r('ui/theme.ts'), e('ui/Button.tsx'),
    c('npm run lint', 0, 0.15),
  ]),
  log('hero', 'Hero session (Saved cards at checkout), before trade-off', HERO_BASE),
];
