import { normalizePhoenixManifest, type AssetManifest, type AssetManifestEntry } from './asset-manifest';
import { normalizeAssetPath } from './asset-paths';
import { phoenixFetch } from './activity';

const PHOENIX_HTTP_BASE = 'http://127.0.0.1:29100';

export type AssetOperationName = 'create-directory' | 'write-file' | 'delete-file' | 'delete-directory' | 'preview-asset';

export interface AssetImpactSection {
  id: string;
  type?: string;
  message?: string;
}

export interface AssetOperationResult {
  requestId: string;
  ok: boolean;
  operation: AssetOperationName;
  entry?: AssetManifestEntry;
  path?: string;
  persisted?: boolean;
  reloadedSections?: AssetImpactSection[];
  deactivatedSections?: AssetImpactSection[];
  failedSections?: AssetImpactSection[];
  code?: string;
  message?: string;
}

export interface PhoenixAssetClient {
  fetchManifest(signal?: AbortSignal): Promise<AssetManifest>;
  createDirectory(path: string, signal?: AbortSignal): Promise<AssetOperationResult>;
  previewFile(path: string, content: string, signal?: AbortSignal): Promise<AssetOperationResult>;
  writeFile(path: string, bytes: Uint8Array, signal?: AbortSignal): Promise<AssetOperationResult>;
  deleteFile(path: string, signal?: AbortSignal): Promise<AssetOperationResult>;
  deleteDirectory(path: string, recursive: boolean, signal?: AbortSignal): Promise<AssetOperationResult>;
}

export function createPhoenixAssetClient(baseUrl = PHOENIX_HTTP_BASE): PhoenixAssetClient {
  const base = baseUrl.replace(/\/$/, '');

  async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await phoenixFetch(`${base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(getNetworkErrorMessage(error));
    }
    const text = await response.text();
    const payload = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      const message = getErrorMessage(payload) ?? `Phoenix request failed with HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function requirePath(path: string): string {
    const normalized = normalizeAssetPath(path);
    if (!normalized) {
      throw new Error('Asset path must be under pool or resources.');
    }
    return normalized.path;
  }

  return {
    async fetchManifest(signal?: AbortSignal): Promise<AssetManifest> {
      const payload = await requestJson('/api/assets/manifest', { signal });
      const manifest = normalizePhoenixManifest(payload);
      if (!manifest) {
        throw new Error('Phoenix returned an invalid asset manifest.');
      }
      return manifest;
    },

    async createDirectory(path, signal): Promise<AssetOperationResult> {
      return normalizeOperationResult(await requestJson('/api/assets/directory', {
        method: 'POST',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), path: requirePath(path) }),
      }), 'create-directory');
    },

    async previewFile(path, content, signal): Promise<AssetOperationResult> {
      return normalizeOperationResult(await requestJson('/api/assets/preview', {
        method: 'PUT',
        signal,
        body: JSON.stringify({
          requestId: createRequestId(),
          path: requirePath(path),
          encoding: 'utf-8',
          content,
        }),
      }), 'preview-asset');
    },

    async writeFile(path, bytes, signal): Promise<AssetOperationResult> {
      return normalizeOperationResult(await requestJson('/api/assets/file', {
        method: 'PUT',
        signal,
        body: JSON.stringify({
          requestId: createRequestId(),
          path: requirePath(path),
          encoding: 'base64',
          content: bytesToBase64(bytes),
        }),
      }), 'write-file');
    },

    async deleteFile(path, signal): Promise<AssetOperationResult> {
      return normalizeOperationResult(await requestJson('/api/assets/file', {
        method: 'DELETE',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), path: requirePath(path) }),
      }), 'delete-file');
    },

    async deleteDirectory(path, recursive, signal): Promise<AssetOperationResult> {
      return normalizeOperationResult(await requestJson('/api/assets/directory', {
        method: 'DELETE',
        signal,
        body: JSON.stringify({ requestId: createRequestId(), path: requirePath(path), recursive }),
      }), 'delete-directory');
    },
  };
}

function getNetworkErrorMessage(error: unknown): string {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser && !window.isSecureContext) {
    return 'Chrome blocked the connection to Phoenix because Cacablu is running from an insecure origin. Open Cacablu from http://127.0.0.1 or http://localhost instead of opening the HTML file directly.';
  }

  return error instanceof Error && error.message
    ? `Could not connect to Phoenix: ${error.message}`
    : 'Could not connect to Phoenix.';
}

function normalizeOperationResult(input: unknown, fallbackOperation: AssetOperationName): AssetOperationResult {
  if (!input || typeof input !== 'object') {
    return {
      requestId: '',
      ok: false,
      operation: fallbackOperation,
      reloadedSections: [],
      deactivatedSections: [],
      failedSections: [],
      code: 'invalid-response',
      message: 'Invalid Phoenix response.',
    };
  }

  const candidate = input as Record<string, unknown>;
  const normalizedPath = typeof candidate.path === 'string' ? normalizeAssetPath(candidate.path) : null;
  return {
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : '',
    ok: candidate.ok !== false,
    operation: isOperation(candidate.operation) ? candidate.operation : fallbackOperation,
    entry: normalizeEntry(candidate.entry),
    path: normalizedPath?.path,
    persisted: typeof candidate.persisted === 'boolean' ? candidate.persisted : undefined,
    reloadedSections: normalizeImpactSections(candidate.reloadedSections),
    deactivatedSections: normalizeImpactSections(candidate.deactivatedSections),
    failedSections: normalizeImpactSections(candidate.failedSections),
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

function normalizeImpactSections(input: unknown): AssetImpactSection[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item): AssetImpactSection[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const rawId = candidate.id;
    if (typeof rawId !== 'string' && typeof rawId !== 'number') return [];
    return [{
      id: String(rawId),
      type: typeof candidate.type === 'string' && candidate.type ? candidate.type : undefined,
      message: typeof candidate.message === 'string' && candidate.message ? candidate.message : undefined,
    }];
  });
}

function normalizeEntry(input: unknown): AssetManifestEntry | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.path !== 'string' || (candidate.kind !== 'file' && candidate.kind !== 'directory')) return undefined;
  const normalized = normalizeAssetPath(candidate.path);
  if (!normalized) return undefined;
  return {
    path: normalized.path,
    kind: candidate.kind,
    size: typeof candidate.size === 'number' ? candidate.size : undefined,
    hash: typeof candidate.hash === 'string' ? candidate.hash : undefined,
  };
}

function getErrorMessage(input: unknown): string | null {
  return input && typeof input === 'object' && typeof (input as Record<string, unknown>).message === 'string'
    ? (input as Record<string, string>).message
    : null;
}

function createRequestId(): string {
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isOperation(value: unknown): value is AssetOperationName {
  return value === 'create-directory' || value === 'write-file' || value === 'delete-file' || value === 'delete-directory' || value === 'preview-asset';
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(''));
}
