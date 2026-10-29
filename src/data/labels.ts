// Hand-authored ground truth for SAMPLE_LOGS. Written by reading each log, not from detector output.
// Waste definitions used when labeling:
//  - retry-loop: the same command or test fails 3+ times with no edit anywhere in between.
//    Span = first to last failing attempt.
//  - repeated-read: the same file is read 3+ times with no edit to that file in between.
//    Span = first to last of those reads.
import type { WasteLabel } from '../core/eventlog';

export const LABELS: WasteLabel[] = [
  { logId: 'retry-1', cls: 'retry-loop', start: 2, end: 5 },
  { logId: 'retry-2', cls: 'retry-loop', start: 1, end: 4 },
  { logId: 'reads-1', cls: 'repeated-read', start: 0, end: 5 },
  { logId: 'reads-2', cls: 'repeated-read', start: 0, end: 4 },
  { logId: 'mixed-1', cls: 'repeated-read', start: 1, end: 8 },
  { logId: 'mixed-1', cls: 'retry-loop', start: 3, end: 7 },
  { logId: 'mixed-2', cls: 'retry-loop', start: 2, end: 5 },
  { logId: 'mixed-2', cls: 'repeated-read', start: 4, end: 7 },
  { logId: 'hero', cls: 'retry-loop', start: 12, end: 17 },
  { logId: 'hero', cls: 'repeated-read', start: 13, end: 16 },
];

// Logs that must produce zero flags.
export const CLEAN_LOG_IDS = ['clean-1', 'clean-2', 'tricky-reread', 'tricky-rerun', 'tricky-mixed-cmds'];
