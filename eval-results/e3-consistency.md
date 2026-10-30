# E3 cross-view consistency

> SYNTHETIC DATA. Replays UI actions (engineer plays T-149, then chooses; leader decides escalations) through the shared reducer and the selectors every view renders from.

| Check | Status | Detail |
|---|---|---|
| Total spend identical in leader and CFO views (initial) | PASS | leader $2347702.43, CFO $2347702.43, CFO weekly chart $2347702.43, recomputed $2347702.43 |
| Total spend identical in leader and CFO views (hero paused) | PASS | leader $2347763.81, CFO $2347763.81, CFO weekly chart $2347763.81, recomputed $2347763.81 |
| Total spend identical in leader and CFO views (engineer finished 6) | PASS | leader $2347776.09, CFO $2347776.09, CFO weekly chart $2347776.09, recomputed $2347776.09 |
| Total spend identical in leader and CFO views (leader approved all) | PASS | leader $2347874.29, CFO $2347874.29, CFO weekly chart $2347874.29, recomputed $2347874.29 |
| Hero quote: ceiling is the top, high no more than 1.3x low | PASS | T-149 quote $45.31-$58.90 (1.30x) |
| Hero cost matches across engineer receipt, leader row and CFO entry | PASS | paused at $61.38; receipt $73.66 = leader task $73.66; CFO capability rises by $73.66 |
| "Do all 14" escalates; the leader decides it | PASS | continue +$110.48 > $20 limit; T-149 stays paused and shows "needs decision"; leader approval moves totals by +$110.48 |
| Engineer choices change the receipt and downstream numbers | PASS | finish 6: $73.66 and new task T-151 quoted $75.54-$98.21; stop: $62.88, not delivered |
| Tagging updates the scorecard | PASS | justified 87.0% -> 86.2%, coverage 72.5% -> 73.2% |
| Decision reaches the CFO view (Q3 note, forecast, Q4 Platform) | PASS | Q3 forecast high $2479656 -> $2182241; Q4 Platform high $699716 -> $402300; Engineering "Q3 actual" = leader total |
| No NaN, negative or empty values (variances excepted) | PASS | all view-level outputs clean across five states |

Overall: PASS (11/11)
