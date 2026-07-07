const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export const LOG_DETAIL_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Essential', value: 1 },
  { label: 'Normal', value: 2 },
  { label: 'Verbose', value: 3 },
] as const;

export type LogDetail = typeof LOG_DETAIL_OPTIONS[number]['value'];

export interface DemoSettings {
  demoName: string;
  loop: boolean;
  sound: boolean;
  debugFloor: boolean;
  logDetail: LogDetail;
  demoStart?: number;
  demoEnd: number;
  debug?: boolean;
  slave?: boolean;
}

export interface DemoSettingsResponse {
  requestId: string;
  ok: boolean;
  settings: DemoSettings;
  logDetailOptions: typeof LOG_DETAIL_OPTIONS;
  path?: string;
  warnings: Array<{ code: string; message: string }>;
}

export interface PhoenixDemoSettingsClient {
  fetchSettings(signal?: AbortSignal): Promise<DemoSettingsResponse>;
  putSettings(settings: DemoSettings, signal?: AbortSignal): Promise<DemoSettingsResponse>;
}

export function createPhoenixDemoSettingsClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixDemoSettingsClient {
  const base = baseUrl.replace(/\/$/, '');

  async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new Error(error instanceof Error ? `Could not connect to Phoenix: ${error.message}` : 'Could not connect to Phoenix.');
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      const message = getErrorMessage(payload) ?? `Phoenix demo settings request failed with HTTP ${response.status}`;
      throw new Error(`${message}: ${summarizePayload(payload)}`);
    }
    return payload;
  }

  return {
    async fetchSettings(signal): Promise<DemoSettingsResponse> {
      const payload = await requestJson('/api/demo-settings', { signal });
      const result = normalizeDemoSettingsResponse(payload);
      if (!result) throw new Error(`Phoenix returned an invalid demo settings response: ${summarizePayload(payload)}`);
      return result;
    },

    async putSettings(settings, signal): Promise<DemoSettingsResponse> {
      const payload = await requestJson('/api/demo-settings', {
        method: 'PUT',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), ...settings }),
      });
      const result = normalizeDemoSettingsResponse(payload);
      if (!result) throw new Error(`Phoenix returned an invalid demo settings response: ${summarizePayload(payload)}`);
      return result;
    },
  };
}

export function normalizeDemoSettingsResponse(input: unknown): DemoSettingsResponse | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (candidate.ok !== true) return null;
  const settings = normalizeDemoSettings(candidate.settings);
  if (!settings) return null;
  return {
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
    ok: true,
    settings,
    logDetailOptions: LOG_DETAIL_OPTIONS,
    path: typeof candidate.path === 'string' ? candidate.path : undefined,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.flatMap((warning) => normalizeWarning(warning))
      : [],
  };
}

function normalizeDemoSettings(input: unknown): DemoSettings | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.demoName !== 'string'
    || typeof value.loop !== 'boolean'
    || typeof value.sound !== 'boolean'
    || typeof value.debugFloor !== 'boolean'
    || !isLogDetail(value.logDetail)
    || typeof value.demoEnd !== 'number'
  ) {
    return null;
  }

  return {
    demoName: value.demoName,
    loop: value.loop,
    sound: value.sound,
    debugFloor: value.debugFloor,
    logDetail: value.logDetail,
    demoStart: typeof value.demoStart === 'number' ? value.demoStart : 0,
    demoEnd: value.demoEnd,
    debug: typeof value.debug === 'boolean' ? value.debug : true,
    slave: typeof value.slave === 'boolean' ? value.slave : true,
  };
}

function normalizeWarning(input: unknown): Array<{ code: string; message: string }> {
  if (!input || typeof input !== 'object') return [];
  const value = input as Record<string, unknown>;
  if (typeof value.code !== 'string' || typeof value.message !== 'string') return [];
  return [{ code: value.code, message: value.message }];
}

function isLogDetail(value: unknown): value is LogDetail {
  return typeof value === 'number' && LOG_DETAIL_OPTIONS.some((option) => option.value === value);
}

function getErrorMessage(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.message !== 'string') return null;
  const details = Array.isArray(value.details)
    ? value.details
      .flatMap((detail) => {
        if (!detail || typeof detail !== 'object') return [];
        const candidate = detail as Record<string, unknown>;
        if (typeof candidate.path !== 'string' || typeof candidate.message !== 'string') return [];
        return [`${candidate.path}: ${candidate.message}`];
      })
      .join('; ')
    : '';
  return details ? `${value.message} (${details})` : value.message;
}

function createRequestId(): string {
  return `demo-settings-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizePayload(payload: unknown): string {
  try {
    const text = JSON.stringify(payload);
    if (!text) return String(payload);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  } catch {
    return String(payload);
  }
}
