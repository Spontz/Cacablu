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
  let phoenixFiles = new Map(
    manifest.entries
      .filter((entry) => entry.kind === 'file' && entry.path.startsWith('pool/'))
      .map((entry) => [entry.path, entry]),
  );
  const needsClean = !poolManifestMatchesPublishedFiles(phoenixFiles, files);

  if (needsClean) {
    throwIfAborted(options.signal);
    onProgress({
      phase: 'cleaning',
      current: 0,
      total: files.length,
      copied: 0,
      skipped: 0,
      failed: 0,
      message: 'Clearing Phoenix pool before sync...',
    });
    await client.deleteDirectory('pool', true, options.signal);
    throwIfAborted(options.signal);
    await client.createDirectory('pool', options.signal);
    phoenixFiles = new Map();
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for (const [index, file] of files.entries()) {
    throwIfAborted(options.signal);
    const current = index + 1;
    const existing = phoenixFiles.get(file.path);

    if (existing?.size === file.bytes) {
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
      await client.writeFile(file.path, file.data, options.signal);
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

function poolManifestMatchesPublishedFiles(
  phoenixFiles: Map<string, { size?: number }>,
  files: PublishedPoolFile[],
): boolean {
  if (phoenixFiles.size !== files.length) return false;

  for (const file of files) {
    const existing = phoenixFiles.get(file.path);
    if (existing?.size !== file.bytes) return false;
  }

  return true;
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
      data: file.data,
    });
  }

  for (const node of buildResourceTree(db)) visit(node);
  published.sort((a, b) => a.path.localeCompare(b.path));
  return published;
}
