import { describe, expect, it } from 'vitest';
import { detect, totalSaved } from './detector';
import type { EventLog, LogEvent } from './eventlog';

const ev = (p: Partial<LogEvent>): LogEvent => ({ t: '00:00', kind: 'read', costDelta: 0.1, ...p });
const mk = (events: LogEvent[]): EventLog => ({ id: 'x', title: 'x', events });

describe('detector', () => {
  it('flags a retry loop of the same failing test with no edits', () => {
    const flags = detect(mk([0, 1, 2].map(() => ev({ kind: 'test', cmd: 'npm test', exitCode: 1 }))));
    expect(flags).toHaveLength(1);
    expect(flags[0].cls).toBe('retry-loop');
    expect(flags[0].dollarsSaved).toBeCloseTo(0.2);
  });

  it('does not flag test re-runs separated by edits', () => {
    const flags = detect(mk([
      ev({ kind: 'test', cmd: 'npm test', exitCode: 1 }), ev({ kind: 'edit', file: 'a.ts' }),
      ev({ kind: 'test', cmd: 'npm test', exitCode: 1 }), ev({ kind: 'edit', file: 'a.ts' }),
      ev({ kind: 'test', cmd: 'npm test', exitCode: 0 }),
    ]));
    expect(flags).toEqual([]);
  });

  it('flags repeated reads of an unchanged file', () => {
    const flags = detect(mk([ev({ file: 'a.ts' }), ev({ file: 'b.ts' }), ev({ file: 'a.ts' }), ev({ file: 'a.ts' })]));
    expect(flags.map((f) => f.cls)).toEqual(['repeated-read']);
    expect(flags[0].start).toBe(0);
    expect(flags[0].end).toBe(3);
  });

  it('does not flag a re-read after the file was edited', () => {
    const flags = detect(mk([ev({ file: 'a.ts' }), ev({ kind: 'edit', file: 'a.ts' }), ev({ file: 'a.ts' }), ev({ kind: 'edit', file: 'a.ts' }), ev({ file: 'a.ts' })]));
    expect(flags).toEqual([]);
  });

  it('never estimates more savings than the log cost', () => {
    const events = [0, 1, 2, 3].map(() => ev({ kind: 'test', cmd: 'x', exitCode: 1, costDelta: 1 }));
    const flags = detect(mk(events));
    expect(totalSaved(flags)).toBeLessThanOrEqual(4);
  });
});
