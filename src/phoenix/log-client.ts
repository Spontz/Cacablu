import { phoenixFetch } from './activity';

const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export interface PhoenixLogEntry {
  sequence?: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface PhoenixLogClient {
  fetchRecent(signal?: AbortSignal): Promise<PhoenixLogEntry[]>;
}

export function createPhoenixLogClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixLogClient {
  const base = baseUrl.replace(/\/$/, '');

  return {
    async fetchRecent(signal): Promise<PhoenixLogEntry[]> {
      let response: Response;
      try {
        response = await phoenixFetch(`${base}/api/logs/recent`, { signal });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        return [];
      }

      if (!response.ok) return [];
      const payload = await response.json() as unknown;
      return normalizePhoenixLogs(payload);
    },
  };
}

function normalizePhoenixLogs(input: unknown): PhoenixLogEntry[] {
  if (!input || typeof input !== 'object') return [];
  const entries = (input as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.message !== 'string') return [];
    const severity = candidate.severity === 'error'
      ? 'error'
      : candidate.severity === 'warning'
        ? 'warning'
        : 'info';
    const sequence = typeof candidate.sequence === 'number' && Number.isFinite(candidate.sequence)
      ? candidate.sequence
      : undefined;
    return [{ sequence, severity, message: candidate.message.trim() }];
  });
}
