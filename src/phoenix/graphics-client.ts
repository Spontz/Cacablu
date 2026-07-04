const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export const GRAPHICS_FBO_FORMATS = [
  'RGB',
  'RGBA',
  'RGB_16F',
  'RGBA_16F',
  'RGB_32F',
  'RGBA_32F',
  'RG_16F',
  'DEPTH',
  'DEPTH_16F',
  'DEPTH_32F',
] as const;

export type GraphicsFboFormat = typeof GRAPHICS_FBO_FORMATS[number];
export type GraphicsFilter = 'bilinear' | 'none';

export interface GraphicsContextSettings {
  colorDepth: number;
  width: number;
  height: number;
  fullscreen: boolean;
  vsync: boolean;
  targetFps: number | null;
}

export interface GraphicsFboRow {
  dbId?: number;
  index: number;
  ratio: number | null;
  format: GraphicsFboFormat;
  width: number | null;
  height: number | null;
  attachments: number;
  filter: GraphicsFilter;
}

export interface GraphicsConfig {
  context: GraphicsContextSettings;
  fbos: GraphicsFboRow[];
}

export interface GraphicsConfigResponse {
  requestId: string;
  ok: boolean;
  config?: GraphicsConfig;
  warnings: Array<{ code: string; message: string }>;
}

export interface PhoenixGraphicsClient {
  fetchConfig(signal?: AbortSignal): Promise<GraphicsConfigResponse>;
  putConfig(config: GraphicsConfig, signal?: AbortSignal): Promise<GraphicsConfigResponse>;
}

export function createPhoenixGraphicsClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixGraphicsClient {
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
      throw new Error(getErrorMessage(payload) ?? `Phoenix graphics request failed with HTTP ${response.status}`);
    }
    return payload;
  }

  return {
    async fetchConfig(signal): Promise<GraphicsConfigResponse> {
      const payload = await requestJson('/api/graphics', { signal });
      const result = normalizeGraphicsResponse(payload);
      if (!result) throw new Error('Phoenix returned an invalid graphics config response.');
      return result;
    },

    async putConfig(config, signal): Promise<GraphicsConfigResponse> {
      const payloadConfig = {
        ...config,
        fbos: config.fbos.map(({ dbId: _dbId, ...fbo }) => fbo),
      };
      const payload = await requestJson('/api/graphics', {
        method: 'PUT',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), ...payloadConfig }),
      });
      const result = normalizeGraphicsResponse(payload);
      if (!result) throw new Error('Phoenix returned an invalid graphics config response.');
      return result;
    },
  };
}

export function normalizeGraphicsResponse(input: unknown): GraphicsConfigResponse | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (candidate.ok !== true) return null;
  const config = normalizeGraphicsConfig(candidate.config);
  return {
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
    ok: true,
    config: config ?? undefined,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.flatMap((warning) => normalizeWarning(warning))
      : [],
  };
}

export function normalizeGraphicsConfig(input: unknown): GraphicsConfig | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  const context = normalizeContext(candidate.context);
  if (!context || !Array.isArray(candidate.fbos)) return null;
  const fbos = candidate.fbos.map((row) => normalizeFbo(row));
  if (fbos.some((row) => row === null)) return null;
  return { context, fbos: fbos as GraphicsFboRow[] };
}

function normalizeContext(input: unknown): GraphicsContextSettings | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.colorDepth !== 'number'
    || typeof value.width !== 'number'
    || typeof value.height !== 'number'
    || typeof value.fullscreen !== 'boolean'
    || typeof value.vsync !== 'boolean'
  ) {
    return null;
  }
  return {
    colorDepth: value.colorDepth,
    width: value.width,
    height: value.height,
    fullscreen: value.fullscreen,
    vsync: value.vsync,
    targetFps: typeof value.targetFps === 'number' ? value.targetFps : null,
  };
}

function normalizeFbo(input: unknown): GraphicsFboRow | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.index !== 'number'
    || !isGraphicsFormat(value.format)
    || typeof value.attachments !== 'number'
    || (value.filter !== 'bilinear' && value.filter !== 'none')
  ) {
    return null;
  }
  return {
    index: value.index,
    ratio: typeof value.ratio === 'number' ? value.ratio : null,
    format: value.format,
    width: typeof value.width === 'number' ? value.width : null,
    height: typeof value.height === 'number' ? value.height : null,
    attachments: value.attachments,
    filter: value.filter,
  };
}

function normalizeWarning(input: unknown): Array<{ code: string; message: string }> {
  if (!input || typeof input !== 'object') return [];
  const value = input as Record<string, unknown>;
  if (typeof value.code !== 'string' || typeof value.message !== 'string') return [];
  return [{ code: value.code, message: value.message }];
}

function isGraphicsFormat(value: unknown): value is GraphicsFboFormat {
  return typeof value === 'string' && (GRAPHICS_FBO_FORMATS as readonly string[]).includes(value);
}

function getErrorMessage(input: unknown): string | null {
  return input && typeof input === 'object' && typeof (input as Record<string, unknown>).message === 'string'
    ? (input as Record<string, string>).message
    : null;
}

function createRequestId(): string {
  return `graphics-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
