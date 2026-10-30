# E2 waste detector

> SYNTHETIC, hand-authored logs. Labels are in src/data/labels.ts, written by reading the logs, not from detector output.

Logs: 12 (5 clean or tricky). Labeled spans: 10.

| Scope | Precision | Recall | Detections | Labels |
|---|---|---|---|---|
| Overall | 100.0% | 100.0% | 10 | 10 |
| Retry loop | 100.0% | 100.0% | 5 | 5 |
| Repeated read | 100.0% | 100.0% | 5 | 5 |

- Precision >= 80%: PASS
- Recall >= 70%: PASS
- Clean and tricky logs flagged: 0 (PASS)
- Logs where estimated savings exceed log cost: 0 (PASS)

| Log | Labels | Flags | Detected spans | Est. saved | Log cost |
|---|---|---|---|---|---|
| clean-1 | 0 | 0 | - | $0.00 | $0.85 |
| clean-2 | 0 | 0 | - | $0.00 | $1.63 |
| tricky-reread | 0 | 0 | - | $0.00 | $1.36 |
| tricky-rerun | 0 | 0 | - | $0.00 | $1.80 |
| tricky-mixed-cmds | 0 | 0 | - | $0.00 | $1.23 |
| retry-1 | 1 | 1 | retry-loop [2-5] | $0.84 | $2.42 |
| retry-2 | 1 | 1 | retry-loop [1-4] | $0.60 | $1.75 |
| reads-1 | 1 | 1 | repeated-read [0-5] | $0.18 | $1.09 |
| reads-2 | 1 | 1 | repeated-read [0-4] | $0.12 | $1.36 |
| mixed-1 | 2 | 2 | repeated-read [1-8], retry-loop [3-7] | $0.74 | $2.32 |
| mixed-2 | 2 | 2 | retry-loop [2-5], repeated-read [4-7] | $0.42 | $1.74 |
| hero | 2 | 2 | repeated-read [6-11], retry-loop [14-16] | $5.30 | $61.38 |
