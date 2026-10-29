# E3 cross-view consistency

> SYNTHETIC DATA. Replays UI actions through the shared reducer and the selectors every view renders from.

| Check | Status | Detail |
|---|---|---|
| Total spend identical in leader and CFO views (initial) | PASS | leader $2347851.95, CFO $2347851.95, CFO weekly chart $2347851.95, recomputed from store $2347851.95 |
| Total spend identical in leader and CFO views (after hero run) | PASS | leader $2347862.43, CFO $2347862.43, CFO weekly chart $2347862.43, recomputed from store $2347862.43 |
| Hero cost matches across receipt, leader row and CFO entry | PASS | receipt $10.48, leader task row $10.48, CFO capability total rises by $10.48 (hero counted inside its capability's 14937 runs) |
| Paused-run decision updates leader view and CFO totals | PASS | T-149 needs decision -> needs review; leader and CFO totals both +$320.00; CFO owner's note and forecast range change ($2099896-$2284529 -> $2146473-$2191616) |
| Tagging updates the scorecard | PASS | justified 87.0% -> 86.2%, coverage 73.0% -> 73.6% |
| Different trade-off changes receipt and downstream numbers | PASS | surface receipt $6.91 vs platform $10.48; CFO row $192031.74 vs $192035.31 |
| Q4 view agrees with Q3 and the paused decision | PASS | Engineering "Q3 actual" $2347851.95 = leader total; all-department so far $1069849 = sum of departments; Platform Q4 forecast high $452009 -> $359096 after the decision |
| No NaN, negative or empty values (variances excepted) | PASS | scorecard, budgets, off-plan, capabilities, reliability, guardrails, forecast all clean |

Overall: PASS (8/8)
