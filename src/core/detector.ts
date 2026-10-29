// Waste detector: finds retry loops and repeated reads in an event log.
import type { EventLog, WasteClass } from './eventlog';

export const MIN_REPEATS = 3;

export interface Flag {
  cls: WasteClass;
  start: number;
  end: number;
  detectedAt: number; // index of the event that crossed the threshold
  subject: string; // command or file
  count: number;
  dollarsSaved: number; // cost of the redundant events (every occurrence after the first)
  message: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function detect(log: EventLog): Flag[] {
  const flags: Flag[] = [];
  const ev = log.events;
  const costOf = (idxs: number[]) => idxs.slice(1).reduce((a, i) => a + ev[i].costDelta, 0);

  // Retry loops: same command failing repeatedly with no edit anywhere in between.
  let fails = new Map<string, number[]>();
  const closeRetry = (cmd: string) => {
    const idxs = fails.get(cmd);
    fails.delete(cmd);
    if (!idxs || idxs.length < MIN_REPEATS) return;
    const saved = costOf(idxs);
    flags.push({
      cls: 'retry-loop', start: idxs[0], end: idxs[idxs.length - 1], detectedAt: idxs[MIN_REPEATS - 1], subject: cmd,
      count: idxs.length, dollarsSaved: saved,
      message: `Retry loop: \`${cmd}\` failed ${idxs.length} times with no code change between attempts. Repeat attempts cost ${money(saved)}.`,
    });
  };
  // Repeated reads: same file read again with no edit to that file in between.
  const reads = new Map<string, number[]>();
  const closeRead = (file: string) => {
    const idxs = reads.get(file);
    reads.delete(file);
    if (!idxs || idxs.length < MIN_REPEATS) return;
    const saved = costOf(idxs);
    flags.push({
      cls: 'repeated-read', start: idxs[0], end: idxs[idxs.length - 1], detectedAt: idxs[MIN_REPEATS - 1], subject: file,
      count: idxs.length, dollarsSaved: saved,
      message: `Repeated reads: \`${file}\` read ${idxs.length} times without being edited. Redundant reads cost ${money(saved)}.`,
    });
  };

  ev.forEach((e, i) => {
    if (e.kind === 'edit') {
      [...fails.keys()].forEach(closeRetry);
      fails = new Map();
      if (e.file) closeRead(e.file);
    } else if (e.kind === 'read' && e.file) {
      reads.set(e.file, [...(reads.get(e.file) ?? []), i]);
    } else if ((e.kind === 'command' || e.kind === 'test') && e.cmd) {
      if (e.exitCode !== 0) fails.set(e.cmd, [...(fails.get(e.cmd) ?? []), i]);
      else closeRetry(e.cmd);
    }
  });
  [...fails.keys()].forEach(closeRetry);
  [...reads.keys()].forEach(closeRead);

  return flags.sort((a, b) => a.detectedAt - b.detectedAt);
}

export const totalSaved = (flags: Flag[]) => flags.reduce((a, f) => a + f.dollarsSaved, 0);
