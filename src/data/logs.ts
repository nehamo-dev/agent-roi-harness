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

// Hero session T-149 (mTLS between services). Step boundaries live in heroScenario.ts.
export const HERO_LOG: E[] = [
  // Started: auth-service, with repeated reads of the design doc (0-8)
  r('docs/mtls-design.md', 0.45), r('services/auth/tls.go', 0.9), r('docs/mtls-design.md', 0.45),
  r('lib/client/transport.go', 1.1), r('docs/mtls-design.md', 0.45), e('lib/client/transport.go', 2.75),
  e('services/auth/main.go', 2.0), t('npm test auth-unit', 0, 2.0), c('deploy --flag mtls auth-service', 0, 2.2),
  // billing-service, with repeated reads of the certificate config (9-15)
  r('certs/config.yaml', 0.634), e('services/billing/tls.go', 4.2), r('certs/config.yaml', 0.634),
  e('services/billing/main.go', 3.1), r('certs/config.yaml', 0.634), r('certs/config.yaml', 0.634),
  t('npm test billing-unit', 0, 2.464),
  // orders-service, with a retry loop on the integration test (16-22)
  e('services/orders/tls.go', 3.0), t('npm test auth-integration', 1, 1.7), t('npm test auth-integration', 1, 1.7),
  t('npm test auth-integration', 1, 1.7), r('test/fixtures/certs.pem', 0.6), e('test/fixtures/certs.pem', 1.5),
  t('npm test auth-integration', 0, 1.98),
  // search and payments, with a rollout-check retry loop, then scope discovery (23-34)
  e('services/search/tls.go', 2.9), e('services/search/main.go', 2.7),
  c('kubectl rollout status deploy/search', 1, 1.0), c('kubectl rollout status deploy/search', 1, 1.0),
  c('kubectl rollout status deploy/search', 1, 1.0), t('npm test search', 0, 2.4),
  e('services/payments/tls.go', 2.7), t('npm test payments', 0, 2.2), r('deploy/sidecar/rotation.yaml', 1.0),
  c('scan-services --needs-mtls', 0, 3.0), r('infra/service-inventory.yaml', 1.0), e('services/payments/main.go', 3.7),
];

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
  log('hero', 'Hero session (mTLS between services)', HERO_LOG),
];
