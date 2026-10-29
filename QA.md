# QA.md: does the demo hold up?

Claude Code: run every automated check yourself and fill in the Result column with PASS, FAIL, or NOT VERIFIED, plus one line of evidence (the command you ran and what it showed). Never mark PASS without running the check. If you cannot verify something visually, mark it NEEDS HUMAN EYES so I can check it. Fix failures that are small. For anything larger, tell me and wait.

## A. Build and run
| # | Check | Result | Evidence |
|---|---|---|---|
| A1 | Fresh clone: `npm install` completes without errors | PASS | Copied repo without node_modules to a scratch folder; `npm ci --offline` exit 0, then `npm run build` succeeded there. (Offline from npm cache, so no network was used.) |
| A2 | `npm run dev` starts and the app loads | PASS | `vite` dev server on :5173; app loaded in the built-in browser, all three tabs render. |
| A3 | `npm run build` succeeds | PASS | `npm run build`: tsc + vite build, "built in 872ms", no errors. |
| A4 | `npm test` passes (estimator and detector tests) | PASS | `npm test`: 2 files, 10 tests passed (estimator 5, detector 5). |
| A5 | `npm run seed` is deterministic: run it twice, outputs are identical | PASS | `npm run seed` twice, `diff` identical; dataset hash c9fe99f2a898fe00 both times (re-run after the estimator recalibration). |
| A6 | `npm run backtest`, `npm run eval:detector`, `npm run eval:consistency` all run | PASS | backtest, eval:detector, eval:consistency, eval:forecast all exit 0. |
| A7 | No console errors or warnings during the full demo walkthrough | PASS | Scripted full walkthrough on a clean load with a window error listener: 0 errors; console scan shows no React/Recharts warnings. Only errors in the console are from Vite hot-reloading store.tsx during development (not on a clean load). |

## B. Engineer view (terminal mock)
| # | Check | Result | Evidence |
|---|---|---|---|
| B1 | Panel is clearly labeled "simulated session" | PASS | Header reads "Engineer: Ana R., Payments" with a "simulated session" pill. |
| B2 | Play, Step, and Reset all work; Reset fully restores the starting state | PASS | Play, Step, Reset clicked in browser. After Reset: terminal shows the start prompt, status "spend $0.00 / envelope $15.90", no receipt, and the leader view reverts T-150 to "still running". |
| B3 | Quote shows a cost range per item (services, security and performance exploration, coding) plus the main risk | PASS | Terminal shows Services $1.03–$3.98, Security and performance exploration $0.83–$3.18, Coding $2.27–$8.75, total $4.13–$15.90, and "Main risk: Ledger module has thin test coverage". |
| B4 | Normal work auto-approves under the dollar threshold, with a visible line saying so | PASS | Line: "Auto-approved: quote ceiling $15.90 is under the $25.00 per-task threshold. Envelope $15.90." |
| B5 | Status line shows spend against the approved envelope and updates as steps play | PASS | Status line went from "spend $0.00 / envelope $15.15 planning" to "$1.18 ... item: Services" to "$6.09 ... waiting for your choice"; envelope rises by the option cost after the choice. (Captured before recalibration; the envelope is now $15.90.) |
| B6 | The correction message comes from the detector module running on the event log, not from hard-coded text | PASS | `buildSteps` in src/core/session.ts calls `detect()` on the hero log and inserts `flag.message`; terminal shows "Detector: Repeated reads: `ledger/LedgerClient.ts` read 3 times..." and "Detector: Retry loop: `npm test checkout` failed 3 times...". |
| B7 | Trade-off prompt is clickable, shows the cost of each option, and the two choices produce different receipts | PASS | Two clickable options: Surface fix +$0.70, Deeper platform fix +$4.27. Receipts: $6.91 vs $10.48. |
| B8 | Receipt shows actual vs plan, the variance explanation, the capability delivered, and the simulated PR | PASS | Receipt shows actual vs quote, per-item actual vs plan, trade-off and waste explanation, "Capability delivered: Saved cards at checkout", "PR #4249 merged (simulated)". |
| B9 | Finishing the run writes the result to the shared store | PASS | After completion, leader "Latest run" shows T-150 at $6.91 (surface) / $10.48 (platform); E3 check confirms the store write. |
| B10 | Rapid clicking on Step or double-clicking Play does not break the sequence | PASS | 60 rapid Step clicks stop at the trade-off prompt (status "waiting for your choice", 2 choices); double Play started one timer only. |

## C. Live quote ("Try it" panel)
| # | Check | Result | Evidence |
|---|---|---|---|
| C1 | Changing task type, size, or repo area changes the quote | PASS | After recalibration: feature/M/payments $4.33–$16.66 → size L $9.50–$36.56 → migration/S/auth $2.93–$11.28. |
| C2 | Panel shows the similar past tasks used | PASS | Panel lists up to 8 similar past tasks with date, type, size, area, team, actual (8 rows shown). |
| C3 | Sparse combinations (few similar tasks) show a wider range or a low-confidence note, not a crash or a made-up number | PASS | After recalibration 15 of 90 combinations are low confidence (the large bugfix, migration and tests tasks in every area). E.g. bugfix/L/auth: 1 similar task, "low confidence" note, range 4.67x wide vs 3.85x for feature/M/auth; no crash. |

## D. Detector log toggle
| # | Check | Result | Evidence |
|---|---|---|---|
| D1 | Clean log shows no flags | PASS | Clean log: 0 flagged rows, "No waste flagged". |
| D2 | Wasteful log shows flags with estimated dollars saved | PASS | Wasteful log: 8 flagged rows, 2 flags, "estimated saved $0.74" of $2.32 log cost. |
| D3 | Switching logs updates the output immediately | PASS | Toggle switches output on click with no reload. |

## E. Leader view
| # | Check | Result | Evidence |
|---|---|---|---|
| E1 | Budget vs actual by team and initiative displays | PASS | Chart by initiative plus team → initiative table with budget, actual, variance (e.g. Payments $230 vs $435.81). |
| E2 | Only off-plan runs are surfaced, with what was done or what needs a decision | PASS | "Off-plan runs only (9 of 150)" with a "What was done / needed" column (e.g. "Ran 56.6x the quote ceiling; reviewed and tagged justified"). |
| E3 | Decision screen for the paused run shows why it stopped, what changed, and options with cost | PASS | Updated by request: shows why it stopped ($160.00 · 27M tokens vs ceiling $58.90 · 9.8M tokens), what changed (6 planned vs 14 found; this run did 2 at $80 each), and 3 options with dollars and tokens: +$720.00 → $880.00 (147M tokens), +$80.00 → $240.00, +$1.50 → $161.50. |
| E4 | Choosing an option resolves the run and updates the other views | PASS | Choosing "Stop and revert" marks T-149 resolved; leader total $1,938 → $1,939; CFO shows $1,939 and "spend that delivered nothing: $62.90". E3 script also checks this. |
| E5 | Guardrail recommendations are computed from the data and cite real numbers | PASS | Computed in `guardrails()`: After recalibration: "65% of 34 web-frontend runs landed inside their quote, vs 73% across all areas"; "5 completed runs went past 3x their ceiling, spending $713 beyond that point". |
| E6 | Tagging queue: yes and no buttons work, and the scorecard updates live | N/A | Tagging queue removed from the leader view by request. The tag action and scorecard update remain in the store and are still checked by E3. |
| E7 | Scorecard shows control by task, control by dollars, justified rate with tag coverage, and quote accuracy | PASS | Tiles after recalibration (hero completed): control by task 86.7%, control by dollars 36.4%, justified 87.0% with tag coverage 72.5%, quote accuracy 66.7%. |
| E8 | The hero task from the engineer view appears here | N/A | "Latest run from the engineer view" card removed from the leader view by request. The hero task still flows into the CFO view (trace link) and E3 checks its cost. |

## F. CFO view
| # | Check | Result | Evidence |
|---|---|---|---|
| F1 | Everything is in dollars and outcomes; the word "token" appears nowhere in the UI (search the source strings) | PASS | Re-checked after tokens were added to the Engineer and Leader views (by request): `grep -n token src/views/CfoView.tsx` → none, and the rendered CFO page text contains "token" 0 times. Token figures live only in Engineer and Leader. |
| F2 | Forecast range for the period is shown, with estimate reliability | PASS | Q4 forecast range $1,319–$2,237 (10th–90th pct) tile, plus "Estimate reliability 66.7%" and a by-month reliability chart. |
| F3 | Cost per capability delivered shows variances explained | PASS | Table has Approved, Actual, Variance and a "Why" column (e.g. "T-102 ran $248 over its ceiling (runaway run)"). |
| F4 | Labeled "cost per outcome, not value" | PASS | Callout: "Cost per outcome, not value." with explanation. |
| F5 | The hero task visibly traces back to the engineer's receipt | PASS | Trace card: "Engineer receipt T-150 (Ana R.): $10.48, PR #4249 → leader view latest run → this page: Saved cards at checkout now costs $56.88 across 6 runs, including T-150's $10.48"; hero row highlighted. |

## G. Labels and honesty
| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | Every view says the data is synthetic | PASS | Global banner "Synthetic data: ... Not real usage." on every tab, plus "synthetic data" / "simulated session" pills in each view (checked by script on all 3 tabs). |
| G2 | No Anthropic logo or mascot anywhere; terminal styling is generic | PASS | `grep -rniE "anthropic|logo|mascot|clawd|.svg|.png" src index.html` → none. Terminal is generic dark monospace. Visual look: NEEDS HUMAN EYES. |
| G3 | README has a real-vs-simulated table, and three spot-checked claims match what the code actually does | PASS | Real-vs-simulated table present. Spot checks: (1) estimator sees only features: `estimate(f: TaskFeatures, pastTasks)` takes no generator params; (2) detector corrections computed: session.ts calls `detect()`; (3) cost scale: computed $14.07 per developer active day, 94% under $30 (README states this). |
| G4 | No numbers that should be computed are hard-coded in view components (search for suspicious literals) | PASS | Grep of numeric literals in src/views and App.tsx: only layout sizes, chart axis domain, tick timing, forecast horizon (13 weeks) and "Q3 2026" label. Fixed one: off-plan "$5" now reads OFF_PLAN_MIN_OVER. |
| G5 | Nothing in the UI or README claims real-world accuracy | PASS | `grep -rniE "accura|real-world|proven|guarantee" src README.md`: only "do not show real-world accuracy" disclaimers and the "Quote accuracy" metric label. |
| G6 | README states how to run, what is real, what is simulated, and what I would build next | PASS | README has how to run, command table, real-vs-simulated table, eval results with misses, and "What I would build next" (real-session hook first). |

## H. Demo flow
| # | Check | Result | Evidence |
|---|---|---|---|
| H1 | The Engineer, then Leader, then CFO story runs in about three minutes with no dead ends | NEEDS HUMAN EYES | Story strip with Step 1/2/3 text and Next buttons added; I clicked through all three views with no dead ends, but did not time a narrated 3-minute run. |
| H2 | Reset returns the whole demo to the start for a second run | PASS | "Reset demo" clicked after a full run: terminal, paused run options (3 again) and hero task restored. |
| H3 | Layout works at about 1280px wide and on a laptop screen | NEEDS HUMAN EYES | Not checked at specific widths. CSS has breakpoints at 900px and 720px. |
| H4 | Reloading the page leaves the app in a sensible state | PASS | Reload returns to Engineer step 1 with seeded data (in-memory state by design). |

## I. Robustness
| # | Check | Result | Evidence |
|---|---|---|---|
| I1 | No NaN, undefined, or empty values display anywhere | PASS | Script scanned visible text of all 3 views after every action for NaN / undefined / null / "$-": clean. E3 check also clean. |
| I2 | Empty states are handled (for example, no off-plan runs, no untagged tasks) | PASS | Code paths: tagging queue shows "All completed runs are tagged."; detector shows "No waste flagged"; Try-it shows "None: cold-start range." Off-plan table has no empty-state message (would render a header-only table); not reachable with this seed. |

## Checks that need my eyes (Claude Code: list what you could not verify)
- Visual quality and readability of each view
- The three-minute walkthrough, played start to finish once
- README read-through
- H1 (timed narration) and H3 (layout at 1280px and on a laptop screen)
- G2 visual: that the terminal looks generic and nothing reads as branded

## After C5: CFO Q4 redesign (from the mockup)
- Section F evidence above describes the earlier Q3-only page. The CFO tab now opens on Q4 2026 so far (all departments, department tabs with status, three figures, by-team notes) with Q3 2026 · Closed one click away. Verified in the browser: no "token" on the page, Q4 Engineering "Q3 actual" equals the leader total, the paused-run decision changes Platform's Q4 note and forecast. NEEDS HUMAN EYES for layout against the mockup.

## Known issues (Claude Code fills this in)
Rank by how much each would hurt the demo, with a one-line suggested fix.
1. FIXED: Try-it panel showed "low confidence" for almost every combination. Confidence now uses the type+size pool, with widening recalibrated on July/August: 15 of 90 combinations are low confidence (was nearly all).
2. E1 coverage still misses (66.7% at 3.48x vs 80% at <= 2.0x), and the costliest 5% are never covered. The recalibration did not carry over from August to September. Next fix: a separate tail allowance in the quote, or more history per type+size. Do not tune the generator.
3. E5 forecast range is very wide (avg 7.2x actual) and the last week is partial (only Sept 28), which counts as a miss. Fix: exclude partial weeks; forecast the body and the tail separately.
4. E2 is 100%/100% but labels and rules share one author. Fix: have someone else label the logs, or use the real-session hook.
5. Off-plan table has no empty-state message. Fix: one line in LeaderView.
6. After the paused run is resolved with "finish planned 6", it still shows as off-plan ("needs review") because it ran over its quote; correct but may confuse. Fix: note "resolved by decision" when pausedDecision is set.
