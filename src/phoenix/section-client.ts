const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export interface PhoenixSectionManifestEntry {
  id: string;
  type: string;
  startTime: number;
  endTime: number;
  enabled: boolean;
  layer: number;
  srcBlending: string;
  dstBlending: string;
  blendingEQ: string;
  contentHash: string;
  size: number;
}

export interface PhoenixSectionManifest {
  root: string;
  entries: PhoenixSectionManifestEntry[];
}

export interface PhoenixSectionPayload {
  id: string;
  type: string;
  startTime: number;
  endTime: number;
  enabled: boolean;
  layer: number;
  srcBlending: string;
  dstBlending: string;
  blendingEQ: string;
  scriptBase64: string;
}

export interface PhoenixSectionSyncResult {
  requestId: string;
  ok: boolean;
  operation: 'replace-all' | 'update-one' | 'delete-many';
  received: number;
  loaded: number;
  failed: number;
  writtenFiles: number;
  deletedFiles: string[];
  failedSections: Array<{ id: string; message: string }>;
  manifest?: PhoenixSectionManifest;
}

export interface PhoenixSectionSyncStatus {
  requestId: string;
  ok: boolean;
  operation: 'replace-all' | 'update-one' | 'delete-many';
  phase: string;
  current: number;
  total: number;
  loaded: number;
  failed: number;
  done: boolean;
  message: string;
}

export interface PhoenixSectionClient {
  fetchManifest(signal?: AbortSignal): Promise<PhoenixSectionManifest>;
  fetchSyncStatus(requestId: string, signal?: AbortSignal): Promise<PhoenixSectionSyncStatus | null>;
  replaceAll(sections: PhoenixSectionPayload[], signal?: AbortSignal, requestId?: string): Promise<PhoenixSectionSyncResult>;
  replaceOne(section: PhoenixSectionPayload, signal?: AbortSignal): Promise<PhoenixSectionSyncResult>;
  deleteMany(ids: string[], signal?: AbortSignal): Promise<PhoenixSectionSyncResult>;
}

export function createPhoenixSectionClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixSectionClient {
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
      throw new Error(getErrorMessage(payload) ?? `Phoenix request failed with HTTP ${response.status}`);
    }
    return payload;
  }

  return {
    async fetchManifest(signal): Promise<PhoenixSectionManifest> {
      const manifest = normalizeSectionManifest(await requestJson('/api/sections/manifest', { signal }));
      if (!manifest) throw new Error('Phoenix returned an invalid section manifest.');
      return manifest;
    },

    async fetchSyncStatus(requestId, signal): Promise<PhoenixSectionSyncStatus | null> {
      const encodedRequestId = encodeURIComponent(requestId);
      const payload = await requestJson(`/api/sections/status/${encodedRequestId}`, { signal });
      return normalizeSectionSyncStatus(payload);
    },

    async replaceAll(sections, signal, requestId): Promise<PhoenixSectionSyncResult> {
      const payload = await requestJson('/api/sections', {
        method: 'PUT',
        signal,
        body: JSON.stringify({ requestId: requestId ?? createRequestId(), sections }),
      });
      const result = normalizeSectionSyncResult(payload);
      if (!result) throw new Error(`Phoenix returned an invalid section sync response: ${summarizePayload(payload)}`);
      return result;
    },

    async replaceOne(section, signal): Promise<PhoenixSectionSyncResult> {
      const payload = await requestJson('/api/sections/section', {
        method: 'PUT',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), sections: [section] }),
      });
      const result = normalizeSectionSyncResult(payload);
      if (!result) throw new Error(`Phoenix returned an invalid section sync response: ${summarizePayload(payload)}`);
      return result;
    },

    async deleteMany(ids, signal): Promise<PhoenixSectionSyncResult> {
      const payload = await requestJson('/api/sections', {
        method: 'DELETE',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), ids }),
      });
      const result = normalizeSectionSyncResult(payload);
      if (!result) throw new Error(`Phoenix returned an invalid section delete response: ${summarizePayload(payload)}`);
      return result;
    },
  };
}

export function normalizeSectionManifest(input: unknown): PhoenixSectionManifest | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (!Array.isArray(candidate.entries)) return null;

  const entries: PhoenixSectionManifestEntry[] = [];
  for (const entry of candidate.entries) {
    if (!entry || typeof entry !== 'object') return null;
    const value = entry as Record<string, unknown>;
    if (
      typeof value.id !== 'string' ||
      typeof value.type !== 'string' ||
      typeof value.startTime !== 'number' ||
      typeof value.endTime !== 'number' ||
      typeof value.enabled !== 'boolean' ||
      typeof value.layer !== 'number' ||
      typeof value.srcBlending !== 'string' ||
      typeof value.dstBlending !== 'string' ||
      typeof value.blendingEQ !== 'string' ||
      typeof value.contentHash !== 'string' ||
      typeof value.size !== 'number'
    ) {
      return null;
    }
    entries.push({
      id: value.id,
      type: value.type,
      startTime: value.startTime,
      endTime: value.endTime,
      enabled: value.enabled,
      layer: value.layer,
      srcBlending: value.srcBlending,
      dstBlending: value.dstBlending,
      blendingEQ: value.blendingEQ,
      contentHash: value.contentHash,
      size: value.size,
    });
  }

  return {
    root: typeof candidate.root === 'string' ? candidate.root : 'phoenix-engine',
    entries,
  };
}

function normalizeSectionSyncResult(input: unknown): PhoenixSectionSyncResult | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (candidate.ok === false) return null;
  return {
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
    ok: candidate.ok !== false,
    operation: candidate.operation === 'delete-many'
      ? 'delete-many'
      : candidate.operation === 'update-one'
        ? 'update-one'
        : 'replace-all',
    received: typeof candidate.received === 'number' ? candidate.received : 0,
    loaded: typeof candidate.loaded === 'number' ? candidate.loaded : 0,
    failed: typeof candidate.failed === 'number' ? candidate.failed : 0,
    writtenFiles: typeof candidate.writtenFiles === 'number' ? candidate.writtenFiles : 0,
    deletedFiles: Array.isArray(candidate.deletedFiles) ? candidate.deletedFiles.filter((value): value is string => typeof value === 'string') : [],
    failedSections: normalizeFailedSections(candidate.failedSections),
    manifest: normalizeSectionManifest(candidate.manifest) ?? undefined,
  };
}

function normalizeSectionSyncStatus(input: unknown): PhoenixSectionSyncStatus | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (candidate.ok !== true) return null;
  return {
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
    ok: true,
    operation: candidate.operation === 'delete-many'
      ? 'delete-many'
      : candidate.operation === 'update-one'
        ? 'update-one'
        : 'replace-all',
    phase: typeof candidate.phase === 'string' ? candidate.phase : 'sections',
    current: typeof candidate.current === 'number' ? candidate.current : 0,
    total: typeof candidate.total === 'number' ? candidate.total : 0,
    loaded: typeof candidate.loaded === 'number' ? candidate.loaded : 0,
    failed: typeof candidate.failed === 'number' ? candidate.failed : 0,
    done: candidate.done === true,
    message: typeof candidate.message === 'string' ? candidate.message : 'Syncing Phoenix sections...',
  };
}

function normalizeFailedSections(input: unknown): Array<{ id: string; message: string }> {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.id !== 'string') return [];
    return [{
      id: candidate.id,
      message: typeof candidate.message === 'string' ? candidate.message : `Could not load section ${candidate.id}`,
    }];
  });
}

function getErrorMessage(input: unknown): string | null {
  return input && typeof input === 'object' && typeof (input as Record<string, unknown>).message === 'string'
    ? (input as Record<string, string>).message
    : null;
}

function createRequestId(): string {
  return `sections-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
