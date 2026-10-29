# E1 estimator backtest

> SYNTHETIC DATA. These numbers show the mechanism works on seeded data. They do not show real-world accuracy.

Train: 106 completed tasks (before 2026-09-01). Test: 42 completed tasks (September).

| Metric | Value | Threshold | Status |
|---|---|---|---|
| Coverage (actual inside quote) | 66.7% | >= 80% with width <= 2.0x | MISS |
| Median range width (high/low) | 3.48x | <= 2.0x | (part of above) |
| Median abs % error, estimator midpoint | 38.5% | | |
| Median abs % error, global average | 201.0% | baseline | |
| Median abs % error, per-developer average | 85.0% | baseline | |
| Median abs % error, per-type average | 168.3% | baseline | |
| Error reduction vs per-developer average | 54.8% | >= 30% | PASS |
| Width-matched naive coverage (per-dev avg, 3.48x) | 42.9% | estimator coverage must be higher | PASS |
| Coverage on costliest 5% (3 tasks) | 0.0% | report only | |
| Low-confidence quotes in test | 12 of 42 | report only | |
