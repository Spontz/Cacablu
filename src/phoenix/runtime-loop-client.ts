import { phoenixFetch } from './activity';

const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export interface RuntimeLoopInterval {
  startTime: number;
  endTime: number;
}

export interface RuntimeLoopResponse {
  requestId: string;
  ok: boolean;
  startTime: number;
  endTime: number;
}

export interface PhoenixRuntimeLoopClient {
  putLoop(interval: RuntimeLoopInterval, signal?: AbortSignal): Promise<RuntimeLoopResponse>;
}

export function createPhoenixRuntimeLoopClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixRuntimeLoopClient {
  const base = baseUrl.replace(/\/$/, '');

  return {
    async putLoop(interval, signal): Promise<RuntimeLoopResponse> {
      let response: Response;
      try {
        response = await phoenixFetch(`${base}/api/runtime/loop`, {
          method: 'PUT',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: createRequestId(),
            startTime: interval.startTime,
            endTime: interval.endTime,
          }),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new Error(error instanceof Error ? `Could not connect to Phoenix: ${error.message}` : 'Could not connect to Phoenix.');
      }

      const payload = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload) ?? `Phoenix runtime loop request failed with HTTP ${response.status}`);
      }

      const result = normalizeRuntimeLoopResponse(payload);
      if (!result) {
        throw new Error('Phoenix returned an invalid runtime loop response.');
      }
      return result;
    },
  };
}

function normalizeRuntimeLoopResponse(input: unknown): RuntimeLoopResponse | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (
    value.ok !== true ||
    typeof value.startTime !== 'number' ||
    typeof value.endTime !== 'number'
  ) {
    return null;
  }
  return {
    requestId: typeof value.requestId === 'string' ? value.requestId : '',
    ok: true,
    startTime: value.startTime,
    endTime: value.endTime,
  };
}

function getErrorMessage(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  return typeof value.message === 'string' ? value.message : null;
}

function createRequestId(): string {
  return `runtime-loop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
