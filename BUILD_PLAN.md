# Build plan (2-hour version): Economic harness demo

## Context
I'm a PM building a demo for a product assignment. Read WRITEUP.md in this folder first: it holds my writeup and the prototype section.

The product is an "economic harness" for Claude Code. It quotes the cost of a task before work starts, keeps spend in range while the agent runs, and reports cost per capability delivered afterward. The demo follows one capability through three views: the engineer (Claude Code-style terminal mock), the engineering leader (dashboard), and the CFO (dashboard).

Supporting files in this folder (read them in C0):
- QA.md: the quality checklist. I wrote the requirements; you fill in the results.
- EVAL.md: the evaluation plan. I wrote the requirements; you fill in the results.
- PROGRESS.md: you create and maintain it (checkpoint status, decisions, open questions).

## Permission rules (important)
- Do NOT write any code until I approve the plan at the end of C0.
- After every checkpoint, STOP and wait for me to say "continue." Do not start the next checkpoint on your own.
- Ask me before: adding dependencies beyond the stack below, deleting or overwriting files I did not ask about, changing the scope or the order of checkpoints, or anything that touches the network.
- For small implementation choices, pick a sensible default, record it in PROGRESS.md, and flag it in the checkpoint summary so I can reverse it.
- I have about 2 hours total. Keep moving. Do not polish.

## Rules
- Stack: Vite, React, TypeScript, Recharts, Vitest. No backend, no database, no real API calls.
- Seeded random generator so data is deterministic. All data is synthetic and labeled as such in the UI.
- Estimator, detector, and forecast logic live in plain TypeScript modules, separate from the UI and separate from the data generator.
- Generic terminal styling only. No Anthropic logo or mascot.
- Tests: one test file for the estimator and one for the detector. Nothing else.
- At the end of each checkpoint, report: what you built, the exact command to run or page to open, what is real vs simulated, and any defaults you chose.

## Speed rules (these override anything in QA.md and EVAL.md)
- QA.md and EVAL.md are for C5 only. Before C5, do not run, update, or discuss them. The only exception is building the backtest and detector scripts that C1 and C2 already require.
- At C5, required: EVAL E1, E2, E3, and QA sections A, B, E, F, G. Do QA sections C, D, H, I and EVAL E4, E5 only if more than 10 minutes remain.
- Run all checks in one pass with scripts, then fill in the result tables in a single edit.
- Cap QA and eval work at 15 minutes total. If a failure takes under 5 minutes to fix, fix it. Otherwise log it under Known issues and move on.
- Never stop for QA or eval approval. The only stops are the end of each checkpoint.

## Data model
Task: id, team, developer, initiative, capability, type, size, repo area, quote (low, high), actual cost, event log id, status (completed, paused, running), justified tag (yes, no, unset), simulated PR number, date.

Seed about 150 tasks across 4 teams over about 3 months. Costs are heavy-tailed and scaled around Claude Code's published average of about $13 per developer per active day (90% of users under $30 per day). Typical tasks cost a few dollars up to the low tens. Add 3-4 runaway runs at $100-$300. Include one "hero" task (a normal run that ends with a correction and a trade-off) and one separate paused run for the leader's decision screen. Pre-tag some completed tasks justified yes or no; leave about 40 unset for the tagging queue.

Event logs: a list of events (file read, edit, command with exit code, test run, timestamp, cost delta). Hand-author ground-truth labels for waste (retry loop, repeated read) in a separate labels file. Labels must not be derived from detector output.

## Checkpoints (time boxes in minutes)

### C0 (10): Read, plan, scaffold
Read WRITEUP.md, QA.md, EVAL.md. Write a plan under 15 lines (modules, data model, how the three views share state). Scaffold the app and create PROGRESS.md. STOP for my approval of the plan.

### C1 (20): Data, estimator, backtest, quote panel
- Seed generator and `npm run seed`. Print median, p90, and the share of total spend from the top 5% and top 10% of runs.
- Estimator: quote a cost range from similar past tasks (type, size, repo area) with assumptions and risk factors. The estimator may only see task features, never generator parameters.
- Time split: train on the first two months, test on the last month.
- `npm run backtest` prints the metrics defined in EVAL.md (E1), with the synthetic-data caveat.
- "Try it" panel: the viewer picks task type, size, and repo area and sees a live quote (range, assumptions, risk factors) plus the similar past tasks used.
STOP.

### C2 (30): Waste detector and engineer view
- Detector finds retry loops and repeated reads of the same file in an event log, with estimated dollars saved.
- At least 10 labeled sample logs (clean, retry loop, repeated reads, mixed). `npm run eval:detector` prints precision and recall per EVAL.md (E2).
- Log toggle in the UI: switch between a clean log and a wasteful one and see the detector output change.
- Terminal-style panel labeled "simulated session" with Play, Step, and Reset. Steps: plan with a cost range per item (services, security and performance exploration, coding) and the main risk; normal work auto-approves under a set dollar threshold; a status line showing spend vs approved envelope; one correction narrated by the detector; a clickable trade-off prompt (surface fix vs deeper platform fix, with the cost of each) where the choice changes the receipt; a receipt (actual vs plan, variance explained, capability delivered, simulated PR).
- On completion, write the result to the shared store.
STOP.

### C3 (20): Leader view
- Budget vs actual by team and initiative. Only off-plan runs are surfaced, with what was done or what needs a decision.
- Decision screen for the paused run (why it stopped, what changed, options with cost). Choosing an option resolves the run and updates every view.
- Two guardrail recommendations computed from the data (for example where estimates are weak, or where the auto-approve threshold should move).
- Justified tagging queue: completed tasks with yes/no buttons. Tagging updates the scorecard live.
- Pilot scorecard: % of tasks under an approved quote or cap, % of spend by dollars under an approved quote or cap, % of completed tasks tagged justified, quote accuracy.
- The hero task from C2 appears here.
STOP.

### C4 (10): CFO view
One page in dollars and outcomes, never tokens. Forecast range for the period computed from history, estimate reliability over time, and cost per capability delivered with variances explained. Label clearly: "cost per outcome, not value." The hero task visibly traces back to the engineer's receipt.
STOP.

### C5 (15): Demo flow, README, QA, eval
- Add `npm run eval:consistency` (EVAL.md E3) and the forecast backtest (EVAL.md E5), saving results under eval-results/.
- Make the demo run in order Engineer, Leader, CFO as a roughly three-minute story.
- README: how to run, a table of real vs simulated, and what I would build next (include the optional hook that logs a real Claude Code session into the detector as a next step).
- Run everything in QA.md and EVAL.md. Fill in the results sections honestly. Mark anything you could not verify yourself (for example visual checks) so I can check it by eye.
STOP with a final report: results, rough edges, and what to fix first.

Buffer: 15 minutes.

## If time runs short, protect in this order
1. Engineer view with the real quote
2. Backtest script and detector eval
3. One of the two dashboards (make the other a single screen)
4. README
5. QA and eval results

## Explicitly NOT building
The real-session hook, a single-file HTML build, pasted custom logs, a full test suite, authentication, or any persistence beyond in-memory state.
