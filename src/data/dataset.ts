// Assembles the demo dataset: generated tasks plus the quote each task would have received
// at the time, using only tasks completed before it.
import { estimate } from '../core/estimator';
import { HERO_QUOTE_MAX_WIDTH } from '../core/session';
import type { CapabilityAggregate, Task } from '../core/types';
import { generateEnterprise } from './enterprise';
import { generateQ4, type Q4Data } from './q4';
import { generate, SEED } from './generate';

export interface Dataset {
  tasks: Task[];
  capabilities: CapabilityAggregate[];
  q4: Q4Data;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildDataset(seed = SEED): Dataset {
  const { tasks } = generate(seed);
  const quoted = tasks.map((t) => {
    const prior = tasks.filter((p) => p.date < t.date && p.status === 'completed');
    const e = estimate({ type: t.type, size: t.size, repoArea: t.repoArea, team: t.team, developer: t.developer }, prior);
    // The hero run commits to a tight quote: the estimator's ceiling, with the low end at ceiling / max width.
    const low = t.role === 'hero' ? e.quote.high / HERO_QUOTE_MAX_WIDTH : e.quote.low;
    return { ...t, quote: { low: round2(low), high: round2(e.quote.high) } };
  });
  const capabilities = generateEnterprise();
  const paused = quoted.find((t) => t.role === 'hero')!.capability;
  return { tasks: quoted, capabilities, q4: generateQ4(capabilities, paused) };
}
