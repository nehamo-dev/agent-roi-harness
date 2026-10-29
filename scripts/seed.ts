import { createHash } from 'node:crypto';
import { buildDataset } from '../src/data/dataset';
import { median, quantile, sum } from '../src/core/stats';

const { tasks, capabilities } = buildDataset();
const done = tasks.filter((t) => t.status === 'completed');
const costs = done.map((t) => t.actualCost).sort((a, b) => b - a);
const total = sum(costs);
const topShare = (p: number) => sum(costs.slice(0, Math.ceil(costs.length * p))) / total;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log('SYNTHETIC DATA. Seeded and deterministic.');
console.log(`Tasks: ${tasks.length} (${done.length} completed, ${tasks.filter((t) => t.status === 'paused').length} paused, ${tasks.filter((t) => t.status === 'running').length} running)`);
console.log(`Teams: ${new Set(tasks.map((t) => t.team)).size}, capabilities: ${capabilities.length}`);
console.log(`Date range: ${tasks[0].date} to ${tasks[tasks.length - 1].date}`);
console.log(`Untagged completed tasks: ${done.filter((t) => t.justified === 'unset').length}`);
console.log(`Median cost: $${median(costs).toFixed(2)}   p90: $${quantile(costs, 0.9).toFixed(2)}   max: $${costs[0].toFixed(2)}`);
console.log(`Runs over $100: ${costs.filter((c) => c > 100).length}`);
console.log(`Total spend: $${total.toFixed(2)}`);
console.log(`Share of spend from top 5% of runs: ${pct(topShare(0.05))}   top 10%: ${pct(topShare(0.1))}`);
const orgSpend = sum(capabilities.map((c) => c.modeledSpend)) + sum(tasks.map((t) => t.actualCost));
const orgBudget = sum(capabilities.map((c) => c.budget));
console.log(`Org scale (modeled ~3,000 engineers): spend $${(orgSpend / 1e6).toFixed(2)}M, budget $${(orgBudget / 1e6).toFixed(2)}M, modeled runs ${sum(capabilities.map((c) => c.modeledRuns)).toLocaleString('en-US')}`);
const ratios = capabilities.map((c) => c.modeledSpend / c.budget);
console.log(`Capabilities over budget: ${ratios.filter((r) => r > 1).length}; under-budget spend/budget range: ${(Math.min(...ratios.filter((r) => r <= 1)) * 100).toFixed(0)}%-${(Math.max(...ratios.filter((r) => r <= 1)) * 100).toFixed(0)}%`);
console.log(`Dataset hash: ${createHash('sha256').update(JSON.stringify({ tasks, capabilities })).digest('hex').slice(0, 16)}`);
