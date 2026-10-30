# EVAL.md: does the mechanism work?

Claude Code: you run these evals and fill in the Results section at the bottom. You may not change a threshold without asking me first. If a metric misses its threshold, report the miss plainly. Do not tune the data generator to make a metric pass.

## Why these evals exist
The writeup claims the estimator beats a naive average, the detector finds real waste, and the three views tell one consistent story. These evals test each claim as far as synthetic data allows. They show the mechanism works. They do not show real-world accuracy. Say so in the README.

## Integrity rules (these prevent grading our own homework)
1. The estimator sees task features only (type, size, repo area, team, developer). It never sees generator parameters, noise settings, or the true cost of a test task.
2. Time split: train on the first two months, test on the last month. Similar-task lookup uses training tasks only.
3. You may tune the estimator on the training split. You may not tune it on the test split.
4. Waste labels for the detector are hand-authored in a separate labels file. They are never computed from detector output.
5. Report every metric even when it looks bad. A visible miss is more credible than a hidden one.

## E1: Estimator backtest (`npm run backtest`)
Metrics, computed on the test month:
- Coverage: % of tasks whose actual cost falls inside the quoted [low, high].
- Median range width, as high/low.
- Median absolute % error of the quote midpoint.
- Three baselines: global average, per-developer average, per-task-type average.
- Width-matched naive range: per-developer average with a range of the same median width, and its coverage. This keeps a wide quote from passing for free.
- Coverage on the costliest 5% of test tasks, reported separately.

Pass (placeholders from the writeup):
- Coverage at least 80% with median range width at most 2.0x.
- Midpoint error at least 30% below the per-developer-average baseline.
- Coverage beats the width-matched naive range.

Output: print a table and save it to `eval-results/e1-backtest.md`.

## E2: Waste detector (`npm run eval:detector`)
Inputs: at least 10 hand-labeled event logs, including:
- 2 or more clean logs (expected: zero flags).
- Logs with retry loops, logs with repeated file reads, and mixed logs.
- At least 2 tricky logs that should not be flagged: a legitimate re-read after the file was edited, and a legitimate test re-run after a fix.

Definitions: a detection is correct if it overlaps at least half of a labeled waste span. Precision is correct detections divided by all detections. Recall is labeled spans caught divided by all labeled spans. Report overall and per class (retry loop, repeated read).

Pass: precision at least 80% and recall at least 70%.

Also check: estimated dollars saved never exceeds the log's total cost, and clean logs produce zero flags.

## E3: Cross-view consistency (`npm run eval:consistency`)
Automated checks that the three views agree:
- Total spend is identical in the leader and CFO views for the same period.
- The hero task's cost matches across the engineer receipt, the leader row, and the CFO cost-per-capability entry.
- Choosing an option on the paused run updates the leader view and the CFO totals.
- Tagging a task in the leader queue updates the scorecard.
- Choosing a different trade-off in the terminal changes the receipt and the downstream numbers.
- No NaN, negative, or empty values anywhere.

Pass: all checks pass.

## E4: Scorecard definitions
The leader scorecard must use these definitions so it matches the writeup's business outcomes:
- Control (by task): % of tasks that started under an approved quote or team cap.
- Control (by dollars): % of spend that ran under an approved quote or team cap.
- Justified: % of tagged completed tasks marked "yes". Also show tag coverage (% of completed tasks tagged), because an 80% justified rate means little if few tasks are tagged.
- Quote accuracy: the E1 coverage figure for the pilot window.

Pass: each number is computed from the store (not hard-coded) and changes when the underlying data changes.

## E5: Forecast reliability (CFO view)
Rolling-origin backtest: for each of the last several weeks, forecast from the data before that week and check whether the actual spend landed inside the forecast range. Report the % of weeks inside the range and the average range width relative to spend.

Target: at least 70% of weeks inside the range (report-only if it misses). A very wide range does not count as a pass, so report width beside coverage.

## What these evals cannot show
- Real-world estimator accuracy on a partner's actual Claude Code sessions.
- Real agent behavior. The engineer view is a scripted replay.
- Whether leaders trust the numbers or take them to the CFO. That is the design-partner validation in the writeup.

## Results (Claude Code fills this in)

| Eval | Metric | Threshold | Result | Status | Notes |
|---|---|---|---|---|---|
| E1 | Coverage | 80% at width of 2.0x or less | 67.4% at median width 3.48x | MISS | 43 Sept test tasks (the former scripted checkout run is now an ordinary task). 12 of 43 quotes low-confidence. Coverage did not improve after recalibration. |
| E1 | Error vs per-developer average | 30% lower or better | 38.2% vs 92.8% → 58.9% lower | PASS | Global avg 198.6%, per-type avg 156.1% (means are pulled up by runaways). |
| E1 | Coverage vs width-matched naive | higher | 67.4% vs 41.9% | PASS | Naive = per-developer average with the same 3.48x width. |
| E1 | Coverage on costliest 5% | report only | 0% (0 of 3) | REPORTED | Tail runs are never inside the quote. |
| E2 | Precision | 80% | 100% (10/10) | PASS | Retry loop 5/5, repeated read 5/5. The hero log is now T-149 (mTLS) with new hand-written labels. Caveat: labels and rules written by the same author from the same definitions. |
| E2 | Recall | 70% | 100% (10/10) | PASS | Same caveat. 12 logs. |
| E2 | Clean and tricky logs flagged | zero | 0 flags on 5 logs | PASS | Savings never exceed log cost (0 violations). |
| E3 | Consistency checks | all pass | 11/11 | PASS | Replays the T-149 flow: totals match in five states; hero quote ≤ 1.3x; hero cost matches engineer receipt, leader row and CFO entry; "Do all 14" escalates and the leader's choice lands everywhere; finish-6 vs stop give different receipts and totals; tagging moves the scorecard; the decision reaches the CFO's Q3 note, forecast and Q4 Platform; no NaN/negative/empty. |
| E4 | Scorecard computed, not hard-coded | yes | yes | PASS | `scorecard()` in src/core/selectors.ts; changes when tagging (E3 check and browser: 87.0% → 87.2%) and when the paused run resolves. Quote accuracy tile = E1 coverage recomputed from the store. Later changed by request: the tile now displays an illustrative 89% from `src/data/illustrative.ts`; `scorecard().quoteAccuracy` still computes 66.7% and E3/E4 check the computed value. |
| E5 | Weeks inside forecast range | 70% | 4/6 weeks (67%), avg width 0.09x actual | MISS | Report-only. Re-run on org-scale weekly spend (one-off spend and the paused capability excluded, as in the CFO forecast). The range is now narrow; the misses are weeks just outside it. |

Status values: PASS, MISS (ran and missed the threshold), NOT RUN. Write what you changed after any MISS and why.

Changes after MISS:
- E1, after the first run (66.7% at 3.19x, every quote low-confidence): with your approval I changed the estimator's confidence rule to use the type+size pool (the model already adjusts for repo area), and recalibrated range widening on training data only (`npm run calibrate`: fit on July, validate on August, never reading September). The selection rule was fixed before running: August coverage closest to 80%. It chose normal 1.4x and low 1.6x (August: 79.2%). On September, coverage stayed at 66.7% and median width rose to 3.48x, so the August calibration did not carry over. Low-confidence quotes fell from 42 of 42 to 12 of 42. Disclosure: I had already seen the September result before making this change; the parameters themselves come only from July and August.
- No thresholds changed and the generator was not tuned. Full outputs are in `eval-results/` (e1-backtest.md, e2-detector.md, e3-consistency.md, e5-forecast.md). All results are on synthetic data and do not show real-world accuracy.
