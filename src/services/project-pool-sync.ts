import type { ProjectDatabase } from '../db/db-schema';
import type { PhoenixAssetClient } from '../phoenix/asset-client';
import { buildResourceTree, type ResourceTreeNode } from '../resources/resource-tree';

export interface ProjectPoolSyncProgress {
  phase: 'scanning' | 'cleaning' | 'copying' | 'sections' | 'complete' | 'error';
  current: number;
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  path?: string;
  message: string;
  indeterminate?: boolean;
}

export interface ProjectPoolSyncResult {
  total: number;
  copied: number;
  skipped: number;
  failed: number;
}

export interface PublishedPoolFile {
  path: string;
  bytes: number;
  hash: string;
  data: Uint8Array;
}

type ProgressListener = (progress: ProjectPoolSyncProgress) => void;

export interface ProjectPoolSyncOptions {
  signal?: AbortSignal;
}

export async function syncPublishedPoolFilesToPhoenix(
  db: ProjectDatabase,
  client: Pick<PhoenixAssetClient, 'createDirectory' | 'deleteDirectory' | 'fetchManifest' | 'writeFile'>,
  onProgress: ProgressListener,
  options: ProjectPoolSyncOptions = {},
): Promise<ProjectPoolSyncResult> {
  throwIfAborted(options.signal);
  const files = collectPublishedPoolFiles(db);
  onProgress({
    phase: 'scanning',
    current: 0,
    total: files.length,
    copied: 0,
    skipped: 0,
    failed: 0,
    message: files.length === 0 ? 'No published pool assets to copy.' : 'Checking Phoenix pool...',
  });

  throwIfAborted(options.signal);
  const manifest = await client.fetchManifest(options.signal);
  // Cacablu owns the published pool snapshot; resources and bootstrap files remain Phoenix-owned here.
  let phoenixFiles = poolFilesFromManifest(manifest.entries);
  const firstDifference = describeFirstPoolDifference(phoenixFiles, files);

  if (!firstDifference) {
    const result = { total: files.length, copied: 0, skipped: files.length, failed: 0 };
    onProgress({
      phase: 'complete',
      current: files.length,
      total: files.length,
      copied: 0,
      skipped: files.length,
      failed: 0,
      message: `Phoenix pool already matches: 0 copied, ${files.length} skipped.`,
    });
    return result;
  }

  throwIfAborted(options.signal);
  onProgress({
    phase: 'cleaning',
    current: 0,
    total: files.length,
    copied: 0,
    skipped: 0,
    failed: 0,
    message: `Clearing Phoenix pool: ${firstDifference}`,
  });
  const deleteResult = await client.deleteDirectory('pool', true, options.signal);
  requireSuccessfulOperation(deleteResult, 'delete Phoenix pool');
  throwIfAborted(options.signal);
  const createResult = await client.createDirectory('pool', options.signal);
  requireSuccessfulOperation(createResult, 'recreate Phoenix pool');

  // Do not upload into a pool that Phoenix reported as deleted but still exposes stale files.
  const cleanedManifest = await client.fetchManifest(options.signal);
  phoenixFiles = poolFilesFromManifest(cleanedManifest.entries);
  if (phoenixFiles.size > 0) {
    const firstRemaining = [...phoenixFiles.keys()].sort((a, b) => a.localeCompare(b))[0];
    throw new Error(`Phoenix pool cleanup did not converge; first remaining file: ${firstRemaining}`);
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for (const [index, file] of files.entries()) {
    throwIfAborted(options.signal);
    const current = index + 1;
    const existing = phoenixFiles.get(file.path);

    if (existing?.size === file.bytes && existing.hash === file.hash) {
      skipped += 1;
      onProgress({
        phase: 'copying',
        current,
        total: files.length,
        copied,
        skipped,
        failed,
        path: file.path,
        message: `Already in Phoenix: ${file.path}`,
      });
      continue;
    }

    onProgress({
      phase: 'copying',
      current,
      total: files.length,
      copied,
      skipped,
      failed,
      path: file.path,
      message: `Copying ${file.path} to Phoenix...`,
    });
    try {
      const writeResult = await client.writeFile(file.path, file.data, options.signal);
      requireSuccessfulOperation(writeResult, `copy ${file.path}`);
      copied += 1;
    } catch {
      throwIfAborted(options.signal);
      failed += 1;
      onProgress({
        phase: 'copying',
        current,
        total: files.length,
        copied,
        skipped,
        failed,
        path: file.path,
        message: `Could not copy ${file.path}; continuing...`,
      });
    }
  }

  if (failed === 0) {
    throwIfAborted(options.signal);
    const rebuiltManifest = await client.fetchManifest(options.signal);
    const rebuiltFiles = poolFilesFromManifest(rebuiltManifest.entries);
    const remainingDifference = describeFirstPoolDifference(rebuiltFiles, files);
    if (remainingDifference) {
      throw new Error(`Phoenix pool rebuild did not converge: ${remainingDifference}`);
    }
  }

  const result = { total: files.length, copied, skipped, failed };
  onProgress({
    phase: failed > 0 ? 'error' : 'complete',
    current: files.length,
    total: files.length,
    copied,
    skipped,
    failed,
    message: failed > 0
      ? `Phoenix pool sync finished with ${failed} failed: ${copied} copied, ${skipped} already present.`
      : `Phoenix pool sync complete: ${copied} copied, ${skipped} already present.`,
  });
  return result;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException('Pool sync cancelled.', 'AbortError');
}

function describeFirstPoolDifference(
  phoenixFiles: Map<string, { size?: number; hash?: string }>,
  files: PublishedPoolFile[],
): string | null {
  for (const file of files) {
    const existing = phoenixFiles.get(file.path);
    if (!existing) return `missing file ${file.path}`;
    if (existing.size !== file.bytes) {
      return `size differs for ${file.path} (${existing.size ?? 'unknown'} in Phoenix, ${file.bytes} in project)`;
    }
    if (existing.hash !== file.hash) return `hash differs for ${file.path}`;
  }

  const projectPaths = new Set(files.map((file) => file.path));
  const extraPath = [...phoenixFiles.keys()]
    .filter((path) => !projectPaths.has(path))
    .sort((a, b) => a.localeCompare(b))[0];
  return extraPath ? `extra file ${extraPath}` : null;
}

function poolFilesFromManifest(
  entries: Array<{ path: string; kind: string; size?: number; hash?: string }>,
): Map<string, { size?: number; hash?: string }> {
  return new Map(
    entries
      .filter((entry) => entry.kind === 'file' && entry.path.startsWith('pool/'))
      .map((entry) => [entry.path, entry]),
  );
}

function requireSuccessfulOperation(
  result: { ok: boolean; message?: string },
  operation: string,
): void {
  if (result.ok) return;
  throw new Error(result.message ? `Could not ${operation}: ${result.message}` : `Could not ${operation}.`);
}

export function collectPublishedPoolFiles(db: ProjectDatabase): PublishedPoolFile[] {
  const filesById = new Map(db.files.map((file) => [file.id, file]));
  const published: PublishedPoolFile[] = [];

  function visit(node: ResourceTreeNode): void {
    if (node.kind === 'folder') {
      for (const child of node.children) visit(child);
      return;
    }

    if (!node.enabled) return;

    const file = filesById.get(node.id);
    if (!file) return;

    published.push({
      path: `pool/${node.path}`,
      bytes: file.bytes,
      hash: hashBytes(file.data),
      data: file.data,
    });
  }

  for (const node of buildResourceTree(db)) visit(node);
  published.sort((a, b) => a.path.localeCompare(b.path));
  return published;
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}
