// Q4 2026 so far (synthetic): all departments' AI spend through the demo's "today".
// Engineering teams continue from the Q3 capability model; other departments are seeded weekly series.
import { makeRng, normal } from '../core/rng';
import type { CapabilityAggregate } from '../core/types';

export const Q4_START = '2026-10-01';
export const Q4_DAYS = 92;
export const AS_OF = '2026-10-29';
export const Q3_WEEKS = 13;

// How a team's note is filled in from the data. Text-only notes are seeded as written.
export type Q4Note =
  | { kind: 'text'; text: string }
  | { kind: 'recurring'; capability: string; text: string } // "{amount}" = that capability's Q3 overrun
  | { kind: 'open-decision' }; // text depends on the leader's decision on the paused run

export interface Q4Team {
  team: string;
  budget: number;
  priorWeekly: number[]; // Q3 weekly spend that carries into Q4 (one-offs and paused work removed)
  q4Weekly: number[]; // Q4 so far; the last entry may be a partial week
  note: Q4Note;
}

export interface Department {
  name: string;
  budget: number;
  teams: Q4Team[];
  engineering: boolean;
}

export interface Q4Data {
  asOf: string;
  start: string;
  days: number;
  departments: Department[];
}

const dayOfQuarter = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(Q4_START + 'T00:00:00Z')) / 86400000) + 1;

// Splits the elapsed days into weeks: full weeks of 7 days, then a partial week.
function weekFractions(days: number): number[] {
  const out: number[] = [];
  for (let d = days; d > 0; d -= 7) out.push(Math.min(7, d) / 7);
  return out;
}

// Q4 multiplier per week, by team: Growth's roll-out ramps up; others hold steady.
const RAMP: Record<string, (w: number) => number> = { Growth: (w) => 1.12 + 0.07 * w };

const ENG_NOTES: Record<string, Q4Note> = {
  Payments: { kind: 'text', text: 'Back to normal after Q3’s testing problem.' },
  Identity: { kind: 'recurring', capability: 'SCIM user provisioning', text: 'Includes about {amount} for continued enterprise sign-in work.' },
  Platform: { kind: 'open-decision' },
  Growth: { kind: 'text', text: 'Roll-out is under way, so spend rises from Q3.' },
};

interface OtherDept { name: string; budgetFactor: number; teams: { team: string; weekly: number; growth: number; note: string }[] }
const OTHER: OtherDept[] = [
  { name: 'Customer Support', budgetFactor: 1.08, teams: [
    { team: 'Frontline support', weekly: 17000, growth: 0, note: 'Steady; reply drafting is now routine.' },
    { team: 'Escalations', weekly: 9000, growth: 0, note: 'In line with ticket volume.' },
    { team: 'Help center', weekly: 6000, growth: 0, note: 'Article refresh finished early in the quarter.' },
  ] },
  { name: 'Marketing', budgetFactor: 0.9, teams: [
    { team: 'Campaigns', weekly: 11000, growth: 0.03, note: 'The holiday campaign moved into Q4, so spend runs above plan.' },
    { team: 'Content', weekly: 8000, growth: 0.01, note: 'More localized versions than budgeted.' },
    { team: 'Web', weekly: 5000, growth: 0, note: 'On plan.' },
  ] },
  { name: 'Sales', budgetFactor: 1.03, teams: [
    { team: 'Account executives', weekly: 18000, growth: 0.01, note: 'Proposal drafting picked up with pipeline.' },
    { team: 'Sales engineering', weekly: 12000, growth: 0, note: 'Demo environment work is on plan.' },
  ] },
];

export function generateQ4(capabilities: CapabilityAggregate[], pausedCapability: string, seed = 4242): Q4Data {
  const rng = makeRng(seed);
  const elapsed = dayOfQuarter(AS_OF);
  const fractions = weekFractions(elapsed);
  const noisy = () => 1 + normal(rng) * 0.06;

  const engTeams: Q4Team[] = [...new Set(capabilities.map((c) => c.team))].map((team) => {
    const caps = capabilities.filter((c) => c.team === team && c.capability !== pausedCapability);
    const priorWeekly = Array.from({ length: Q3_WEEKS }, (_, i) => caps.reduce((a, c) => a + c.weekly[i] - c.oneOffWeekly[i], 0));
    const rate = priorWeekly.reduce((a, b) => a + b, 0) / Q3_WEEKS;
    const ramp = RAMP[team] ?? (() => 1);
    const q4Weekly = fractions.map((f, w) => rate * ramp(w) * noisy() * f);
    const q3Budget = capabilities.filter((c) => c.team === team).reduce((a, c) => a + c.budget, 0);
    return { team, budget: Math.round((q3Budget * 0.86) / 10000) * 10000, priorWeekly, q4Weekly, note: ENG_NOTES[team] ?? { kind: 'text', text: 'On plan.' } };
  });

  const others: Department[] = OTHER.map((d) => {
    const teams = d.teams.map((t): Q4Team => {
      const priorWeekly = Array.from({ length: Q3_WEEKS }, () => t.weekly * 0.95 * noisy());
      const q4Weekly = fractions.map((f, w) => t.weekly * (1 + t.growth * w) * noisy() * f);
      return { team: t.team, budget: 0, priorWeekly, q4Weekly, note: { kind: 'text', text: t.note } };
    });
    const planned = teams.reduce((a, t) => a + (t.priorWeekly.reduce((x, y) => x + y, 0) / Q3_WEEKS) * (Q4_DAYS / 7), 0);
    return { name: d.name, budget: Math.round((planned * d.budgetFactor) / 10000) * 10000, teams, engineering: false };
  });

  const engBudget = engTeams.reduce((a, t) => a + t.budget, 0);
  return { asOf: AS_OF, start: Q4_START, days: Q4_DAYS, departments: [{ name: 'Engineering', budget: engBudget, teams: engTeams, engineering: true }, ...others] };
}
