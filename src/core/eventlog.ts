export type EventKind = 'read' | 'edit' | 'command' | 'test';

export interface LogEvent {
  t: string; // mm:ss since session start
  kind: EventKind;
  file?: string; // read, edit
  cmd?: string; // command, test
  exitCode?: number; // command, test
  costDelta: number; // dollars
}

export interface EventLog {
  id: string;
  title: string;
  events: LogEvent[];
}

export type WasteClass = 'retry-loop' | 'repeated-read';

// Inclusive event index span.
export interface WasteLabel {
  logId: string;
  cls: WasteClass;
  start: number;
  end: number;
}

export const logCost = (log: EventLog) => log.events.reduce((a, e) => a + e.costDelta, 0);
