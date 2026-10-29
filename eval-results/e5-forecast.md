# E5 forecast reliability (rolling origin)

> SYNTHETIC DATA. Each week is forecast from the weeks before it only (bootstrap of up to 8 prior weeks, 10th-90th percentile). Report-only target: 70% of weeks inside.

| Week of | Actual | Forecast range | Inside | Range width / actual |
|---|---|---|---|---|
| 2026-08-19 | $167K | $156K – $173K | yes | 0.10x |
| 2026-08-26 | $161K | $156K – $173K | yes | 0.10x |
| 2026-09-02 | $164K | $156K – $173K | yes | 0.10x |
| 2026-09-09 | $159K | $161K – $173K | no | 0.07x |
| 2026-09-16 | $160K | $159K – $173K | yes | 0.09x |
| 2026-09-23 | $156K | $159K – $173K | no | 0.09x |

Weeks inside range: 4/6 (67%) · misses 70% target
Average range width relative to actual spend: 0.09x
