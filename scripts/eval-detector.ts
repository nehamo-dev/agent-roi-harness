// E2: detector precision and recall against hand-authored labels. Synthetic logs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { detect, totalSaved, type Flag } from '../src/core/detector';
import { logCost, type WasteClass, type WasteLabel } from '../src/core/eventlog';
import { CLEAN_LOG_IDS, LABELS } from '../src/data/labels';
import { SAMPLE_LOGS } from '../src/data/logs';

const overlapOk = (f: Flag, l: WasteLabel) => {
  const ov = Math.min(f.end, l.end) - Math.max(f.start, l.start) + 1;
  return f.cls === l.cls && ov >= 0.5 * (l.end - l.start + 1);
};

const rows: string[] = [];
const all: { flag: Flag; logId: string }[] = [];
let costViolations = 0;
for (const log of SAMPLE_LOGS) {
  const flags = detect(log);
  flags.forEach((flag) => all.push({ flag, logId: log.id }));
  const saved = totalSaved(flags);
  if (saved > logCost(log)) costViolations++;
  const labels = LABELS.filter((l) => l.logId === log.id);
  rows.push(`| ${log.id} | ${labels.length} | ${flags.length} | ${flags.map((f) => `${f.cls} [${f.start}-${f.end}]`).join(', ') || '-'} | $${saved.toFixed(2)} | $${logCost(log).toFixed(2)} |`);
}

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');
function score(cls?: WasteClass) {
  const dets = all.filter((d) => !cls || d.flag.cls === cls);
  const labs = LABELS.filter((l) => !cls || l.cls === cls);
  const correct = dets.filter((d) => LABELS.some((l) => l.logId === d.logId && overlapOk(d.flag, l))).length;
  const caught = labs.filter((l) => all.some((d) => d.logId === l.logId && overlapOk(d.flag, l))).length;
  return { precision: correct / dets.length, recall: caught / labs.length, dets: dets.length, labs: labs.length };
}
const o = score();
const rl = score('retry-loop');
const rr = score('repeated-read');
const cleanFlags = SAMPLE_LOGS.filter((l) => CLEAN_LOG_IDS.includes(l.id)).reduce((a, l) => a + detect(l).length, 0);
const st = (p: boolean) => (p ? 'PASS' : 'MISS');

const out = [
  '# E2 waste detector',
  '',
  '> SYNTHETIC, hand-authored logs. Labels are in src/data/labels.ts, written by reading the logs, not from detector output.',
  '',
  `Logs: ${SAMPLE_LOGS.length} (${CLEAN_LOG_IDS.length} clean or tricky). Labeled spans: ${LABELS.length}.`,
  '',
  '| Scope | Precision | Recall | Detections | Labels |',
  '|---|---|---|---|---|',
  `| Overall | ${pct(o.precision)} | ${pct(o.recall)} | ${o.dets} | ${o.labs} |`,
  `| Retry loop | ${pct(rl.precision)} | ${pct(rl.recall)} | ${rl.dets} | ${rl.labs} |`,
  `| Repeated read | ${pct(rr.precision)} | ${pct(rr.recall)} | ${rr.dets} | ${rr.labs} |`,
  '',
  `- Precision >= 80%: ${st(o.precision >= 0.8)}`,
  `- Recall >= 70%: ${st(o.recall >= 0.7)}`,
  `- Clean and tricky logs flagged: ${cleanFlags} (${st(cleanFlags === 0)})`,
  `- Logs where estimated savings exceed log cost: ${costViolations} (${st(costViolations === 0)})`,
  '',
  '| Log | Labels | Flags | Detected spans | Est. saved | Log cost |',
  '|---|---|---|---|---|---|',
  ...rows,
].join('\n') + '\n';
console.log(out);
mkdirSync('eval-results', { recursive: true });
writeFileSync('eval-results/e2-detector.md', out);
console.log('Saved eval-results/e2-detector.md');
