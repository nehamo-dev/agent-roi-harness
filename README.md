# agent-roi-harness

An economic harness for coding agents. It quotes cost from similar past work before a task starts, keeps spend in range while the agent runs by catching waste and asking a human only at real trade-offs, then reports cost per delivered capability. Demo with synthetic data: engineer, engineering leader, and CFO views. The demo follows one capability ("Saved cards at checkout") through all three.

**All data is synthetic.** Tasks, costs, teams, developers, PRs and tickets are seeded and simulated. The evals below show the mechanism works on that data. They do not show real-world accuracy.

## How to run

Requires Node 20+.

```bash
npm install
npm run dev          # open http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run seed` | Prints dataset stats (median, p90, top 5% / 10% share of spend) and a hash to confirm determinism |
| `npm run calibrate` | Picks range widening using July (fit) and August (validate) only |
| `npm run backtest` | E1 estimator backtest (train Jul–Aug, test Sep) → `eval-results/e1-backtest.md` |
| `npm run eval:detector` | E2 detector precision/recall vs hand labels → `eval-results/e2-detector.md` |
| `npm run eval:consistency` | E3 cross-view consistency checks → `eval-results/e3-consistency.md` |
| `npm run eval:forecast` | E5 rolling-origin forecast backtest → `eval-results/e5-forecast.md` |
| `npm test` | Vitest: estimator and detector tests |
| `npm run build` | Typecheck and production build |

## The three-minute demo

Press **▶ Play demo** in the header for a guided tour: it resets the demo, drives each step itself (approve, run, decide) and spotlights what matters for the engineer, the VP of Engineering and the CFO. Use Next / Back or the arrow keys; Esc exits. Or walk it yourself:


1. **Engineer** (about 1 min), shown as a desktop coding-agent app with an Economics panel on the right: task T-149, "Require mTLS between internal services" (Max W., Platform). Approve the 9.82M-token ceiling and start. The harness self-corrects four times (two repeated reads, two retry loops), each shown with its savings, then stops the run when it finds 14 services instead of the 6 planned. Choose: do all 14, finish the 6 and re-quote the rest, or stop and revert. Each choice ends in a receipt. Amounts in this view are in tokens.
2. **VP Engineering** (about 1 min): the quarter's forecast against plan leads, then control and quote accuracy; budget vs actual by team, and only the runs that went off plan, including T-149 with Max's choice.
3. **CFO** (about 1 min): the quarter's forecast leads, across departments and for Engineering by team, with cost per capability open on the page. Labeled "cost per outcome, not value".

The story strip under the banner has a Next button for each step. "Reset demo" returns everything to the start.

## What is real vs simulated

| Part | Real or simulated | Notes |
|---|---|---|
| Org-scale spend (17 capabilities, ~$2.3M a quarter, ~3,000 engineers at ~$250/month) | Simulated | `src/data/enterprise.ts`. Each capability's total is built from runs drawn from the same per-run distribution as the task history; the 150 sampled tasks, including the hero run, are added on top |
| Q4 2026 so far, all departments (Engineering, Customer Support, Marketing, Sales) | Simulated | `src/data/q4.ts`. Engineering teams continue from the Q3 model (one-offs removed, Growth ramping, the paused capability's open scope added by decision); other departments are seeded weekly series. Forecast and accuracy computed in `src/core/q4.ts` |
| Owner's notes on over-budget capabilities | Simulated | `src/data/ownerNotes.ts`; the paused capability's note comes from the leader's decision |
| Task history (150 tasks, 4 teams, Jul–Sep 2026) | Simulated | Seeded generator (`src/data/generate.ts`), heavy-tailed costs; averages $14 per developer per active day with 94% of developer-days under $30 (Claude Code docs: ~$13 average, 90% under $30), 4 runaway runs at $100–$300 |
| Cost estimator and quotes | **Real logic** on simulated data | `src/core/estimator.ts`. Sees task features and past tasks only, never generator parameters |
| Estimator backtest (E1) | **Real** on simulated data | Time split; three naive baselines and a width-matched naive range |
| Waste detector | **Real logic** | `src/core/detector.ts`. Rule-based: retry loops and repeated reads |
| Sample event logs and waste labels | Simulated, hand-authored | `src/data/logs.ts`, `src/data/labels.ts` |
| Engineer session (T-149) | Simulated (scripted replay) | Spend at each step, the two corrections and their savings (from the detector), the quote band, and the option costs (from the run's own rate per service) are computed from the scripted event log. Scope discovery (6 planned, 14 found) is scripted |
| Task card text, scope story, simulated Jira ticket PLAT-2417 | Simulated | `src/data/heroScenario.ts`, `src/data/pausedScenario.ts` |
| Budgets per initiative | Simulated | Derived from synthetic spend |
| Leader scorecard, off-plan runs, guardrails, decision costs | **Real logic** on simulated data | `src/core/selectors.ts`, `src/core/decision.ts` |
| CFO forecast range and reliability | **Real logic** on simulated data | `src/core/forecast.ts`: bootstrap of recent weekly spend |
| AI tokens beside actual costs (Engineer and Leader views) | Simulated conversion | One blended rate, $6 per million tokens (`src/core/tokens.ts`). The CFO view stays in dollars |
| Q4-to-date spend ($1.1M of $2.9M), quote accuracy (89%) and control by dollars (60%) on the leader scorecard; Engineering's Q4 $1.1M of $2.9M and green status on the CFO page; and Engineering forecast accuracy on the CFO page (8 of 9 weeks) | **Illustrative, set for the demo** | `src/data/illustrative.ts`. The computed values on this data are lower and are reported unchanged (E1 coverage 67.4%, control by dollars about 36%, E5 67%) |
| PRs, merges, ticket links | Simulated | PR numbers are synthetic; nothing is merged |
| Persistence | None | In-memory only; reload resets the demo |

## Eval results (synthetic data)

| Eval | Result |
|---|---|
| E1 coverage | 67.4% at a median range width of 3.48x. **Misses** the target of 80% at ≤ 2.0x. Range widening was recalibrated on July/August only; it did not improve September |
| E1 error vs per-developer average | 58.9% lower. Passes (target ≥ 30%) |
| E1 coverage vs width-matched naive range | 67.4% vs 41.9%. Passes |
| E2 precision / recall | 100% / 100% on 12 logs. Caveat: the labels and the detector rules came from the same author and definitions |
| E3 consistency | 11/11 checks pass |
| E5 forecast | 4 of 6 weeks inside the range (67%) on org-scale weekly spend, range about 0.09x of spend. Misses the 70% target (report-only) |

Full tables are in `eval-results/`, and the summary is in `EVAL.md`.

## What I would build next

1. **Real-session hook.** A Claude Code hook that logs tool calls (reads, edits, commands with exit codes) and per-step cost from a real session into the same event-log format, so the detector runs on real sessions instead of hand-authored ones. This is the most important next step: it replaces the scripted replay and tests the detector on waste nobody labeled in advance.
2. **A first-class budget checkpoint.** Pause-and-approve when a run crosses its envelope, instead of simulating it in the UI.
3. **Better calibration of the tail.** Widening is already calibrated on a training-only split (`npm run calibrate`), but E1 coverage still misses and the costliest 5% are never covered. Next: a separate tail allowance in the quote, and more history per task type and size.
4. **Attribution.** Session → PR → ticket links, so "capability delivered" comes from merged work rather than seeded labels.
5. **Design-partner validation.** Put the leader scorecard in front of 3–5 VPs of Engineering and test whether they would take it to finance.
