# E1 estimator backtest

> SYNTHETIC DATA. These numbers show the mechanism works on seeded data. They do not show real-world accuracy.

Train: 106 completed tasks (before 2026-09-01). Test: 43 completed tasks (September).

| Metric | Value | Threshold | Status |
|---|---|---|---|
| Coverage (actual inside quote) | 67.4% | >= 80% with width <= 2.0x | MISS |
| Median range width (high/low) | 3.48x | <= 2.0x | (part of above) |
| Median abs % error, estimator midpoint | 38.2% | | |
| Median abs % error, global average | 198.6% | baseline | |
| Median abs % error, per-developer average | 92.8% | baseline | |
| Median abs % error, per-type average | 156.1% | baseline | |
| Error reduction vs per-developer average | 58.9% | >= 30% | PASS |
| Width-matched naive coverage (per-dev avg, 3.48x) | 41.9% | estimator coverage must be higher | PASS |
| Coverage on costliest 5% (3 tasks) | 0.0% | report only | |
| Low-confidence quotes in test | 12 of 43 | report only | |
