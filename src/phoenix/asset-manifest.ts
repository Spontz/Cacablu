import { normalizeAssetPath } from './asset-paths';

export type AssetManifestRoot = 'local-project' | 'phoenix-engine';
export type AssetEntryKind = 'file' | 'directory';
export type AssetDiscrepancyKind = 'missing-local' | 'missing-phoenix' | 'changed' | 'type-mismatch';

export interface AssetManifestEntry {
  path: string;
  kind: AssetEntryKind;
  size?: number;
  hash?: string;
  lastModified?: number;
}

export interface AssetManifest {
  root: AssetManifestRoot;
  generatedAt: string;
  entries: AssetManifestEntry[];
  errors: AssetManifestError[];
}

export interface AssetManifestError {
  path: string;
  message: string;
}

export interface AssetDiscrepancy {
  path: string;
  kind: AssetDiscrepancyKind;
  localEntry?: AssetManifestEntry;
  phoenixEntry?: AssetManifestEntry;
}

export interface AssetDirectoryHandle {
  readonly name: string;
  readonly kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<AssetDirectoryHandle>;
  values(): AsyncIterable<AssetDirectoryEntryHandle>;
}

export interface AssetFileHandle {
  readonly name: string;
  readonly kind: 'file';
  getFile(): Promise<File | Blob>;
}

export type AssetDirectoryEntryHandle = AssetDirectoryHandle | AssetFileHandle;

export async function buildLocalAssetManifest(dataFolder: AssetDirectoryHandle): Promise<AssetManifest> {
  const entries: AssetManifestEntry[] = [];
  const errors: AssetManifestError[] = [];

  for (const rootName of ['pool', 'resources'] as const) {
    try {
      const root = await dataFolder.getDirectoryHandle(rootName);
      entries.push({ path: rootName, kind: 'directory' });
      await walkDirectory(root, rootName, entries, errors);
    } catch (err) {
      errors.push({
        path: rootName,
        message: err instanceof Error ? err.message : `Missing ${rootName} folder`,
      });
    }
  }

  entries.sort(compareEntries);
  return {
    root: 'local-project',
    generatedAt: new Date().toISOString(),
    entries,
    errors,
  };
}

export function normalizePhoenixManifest(input: unknown): AssetManifest | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (!Array.isArray(candidate.entries)) return null;

  const entries: AssetManifestEntry[] = [];
  for (const rawEntry of candidate.entries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.path !== 'string') continue;
    if (entry.kind !== 'file' && entry.kind !== 'directory') continue;

    const normalized = normalizeAssetPath(entry.path);
    if (!normalized) continue;

    entries.push({
      path: normalized.path,
      kind: entry.kind,
      size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : undefined,
      hash: typeof entry.hash === 'string' ? entry.hash : undefined,
      lastModified: typeof entry.lastModified === 'number' && Number.isFinite(entry.lastModified) ? entry.lastModified : undefined,
    });
  }

  entries.sort(compareEntries);
  return {
    root: 'phoenix-engine',
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    entries,
    errors: [],
  };
}

export function compareAssetManifests(localManifest: AssetManifest, phoenixManifest: AssetManifest): AssetDiscrepancy[] {
  const local = new Map(localManifest.entries.map((entry) => [entry.path, entry]));
  const phoenix = new Map(phoenixManifest.entries.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...local.keys(), ...phoenix.keys()])].sort((a, b) => a.localeCompare(b));
  const discrepancies: AssetDiscrepancy[] = [];

  for (const path of paths) {
    const localEntry = local.get(path);
    const phoenixEntry = phoenix.get(path);

    if (!localEntry && phoenixEntry) {
      discrepancies.push({ path, kind: 'missing-local', phoenixEntry });
      continue;
    }

    if (localEntry && !phoenixEntry) {
      discrepancies.push({ path, kind: 'missing-phoenix', localEntry });
      continue;
    }

    if (!localEntry || !phoenixEntry) continue;

    if (localEntry.kind !== phoenixEntry.kind) {
      discrepancies.push({ path, kind: 'type-mismatch', localEntry, phoenixEntry });
      continue;
    }

    if (localEntry.kind === 'file' && (localEntry.size !== phoenixEntry.size || localEntry.hash !== phoenixEntry.hash)) {
      discrepancies.push({ path, kind: 'changed', localEntry, phoenixEntry });
    }
  }

  return discrepancies;
}

async function walkDirectory(
  directory: AssetDirectoryHandle,
  prefix: string,
  entries: AssetManifestEntry[],
  errors: AssetManifestError[],
): Promise<void> {
  for await (const entry of directory.values()) {
    const path = `${prefix}/${entry.name}`;
    const normalized = normalizeAssetPath(path);
    if (!normalized) {
      errors.push({ path, message: 'Invalid asset path' });
      continue;
    }

    if (entry.kind === 'directory') {
      entries.push({ path: normalized.path, kind: 'directory' });
      await walkDirectory(entry, normalized.path, entries, errors);
      continue;
    }

    try {
      const file = await entry.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      entries.push({
        path: normalized.path,
        kind: 'file',
        size: bytes.byteLength,
        hash: hashBytes(bytes),
        lastModified: 'lastModified' in file && typeof file.lastModified === 'number' ? file.lastModified : undefined,
      });
    } catch (err) {
      errors.push({
        path: normalized.path,
        message: err instanceof Error ? err.message : 'Could not read file',
      });
    }
  }
}

function compareEntries(a: AssetManifestEntry, b: AssetManifestEntry): number {
  return a.path.localeCompare(b.path);
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
