import type { AppState } from '../state/app-state';
import type { PhoenixLogClient, PhoenixLogEntry } from './log-client';

const recordedPhoenixLogs = new Set<string>();

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
): Promise<number> {
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
        description: entry.message,
      }));

    state.addEvents(events);
    return events.length;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return 0;
  }
}

function createLogKey(entry: PhoenixLogEntry): string {
  if (entry.sequence !== undefined) {
    return `${entry.sequence}:${entry.severity}:${entry.message}`;
  }
  return `${entry.severity}:${entry.message}`;
}
