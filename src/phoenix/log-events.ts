import type { AppState } from '../state/app-state';
import type { PhoenixLogClient, PhoenixLogEntry } from './log-client';

const recordedPhoenixLogs = new Set<string>();
export const PHOENIX_LOG_EVENT_SOURCE = 'Phoenix log';

export interface PhoenixLogEventRecordResult {
  totalCount: number;
  errorCount: number;
  unassignedErrorCount: number;
  errorSubjectIds: number[];
}

export async function primePhoenixLogEvents(
  client: PhoenixLogClient,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const logs = await client.fetchRecent(signal);
    for (const entry of logs) {
      recordedPhoenixLogs.add(createLogKey(entry));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
  }
}

export async function recordPhoenixLogsAsEvents(
  state: Pick<AppState, 'addEvents'>,
  client: PhoenixLogClient,
  signal?: AbortSignal,
): Promise<PhoenixLogEventRecordResult> {
  try {
    const logs = await client.fetchRecent(signal);
    const events = logs
      .filter((entry) => entry.message.trim() !== '')
      .filter((entry) => {
        const key = createLogKey(entry);
        if (recordedPhoenixLogs.has(key)) return false;
        recordedPhoenixLogs.add(key);
        return true;
      })
      .map((entry) => ({
        severity: entry.severity,
        source: PHOENIX_LOG_EVENT_SOURCE,
        subjectId: inferProblemBarId(entry.message)?.toString(),
        description: entry.message,
      }));
    annotateEventGroups(events);

    state.addEvents(events);
    const errorSubjectIds = new Set<number>();
    let unassignedErrorCount = 0;
    for (const event of events) {
      if (event.severity !== 'error') continue;
      const subjectId = event.subjectId ? Number(event.subjectId) : Number.NaN;
      if (Number.isInteger(subjectId)) {
        errorSubjectIds.add(subjectId);
      } else {
        unassignedErrorCount += 1;
      }
    }
    return {
      totalCount: events.length,
      errorCount: events.filter((event) => event.severity === 'error').length,
      unassignedErrorCount,
      errorSubjectIds: [...errorSubjectIds],
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { totalCount: 0, errorCount: 0, unassignedErrorCount: 0, errorSubjectIds: [] };
  }
}

function annotateEventGroups(events: Array<{ severity: string; subjectId?: string; description: string }>): void {
  let pendingErrorEvents: Array<{ subjectId?: string }> = [];

  for (const event of events) {
    if (event.subjectId) {
      for (const pending of pendingErrorEvents) {
        pending.subjectId = event.subjectId;
      }
      pendingErrorEvents = [];
      continue;
    }

    if (event.severity === 'error') {
      pendingErrorEvents.push(event);
    } else {
      pendingErrorEvents = [];
    }
  }
}

function inferProblemBarId(message: string): number | null {
  const patterns = [
    /\[id:\s*(\d+)\b/i,
    /\b[A-Za-z][A-Za-z0-9 _-]*\s+\[(\d+)\]\s*:/,
    /\bSection\s+(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const id = Number(match[1]);
    if (Number.isInteger(id)) return id;
  }

  return null;
}

function createLogKey(entry: PhoenixLogEntry): string {
  if (entry.sequence !== undefined) {
    return `${entry.sequence}:${entry.severity}:${entry.message}`;
  }
  return `${entry.severity}:${entry.message}`;
}
