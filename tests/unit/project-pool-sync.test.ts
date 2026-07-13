import { describe, expect, it, vi } from 'vitest';

import type { ProjectDatabase } from '../../src/db/db-schema';
import type { AssetManifest, AssetManifestEntry } from '../../src/phoenix/asset-manifest';
import {
  collectPublishedPoolFiles,
  syncPublishedPoolFilesToPhoenix,
  type ProjectPoolSyncProgress,
} from '../../src/services/project-pool-sync';

function makeDb(): ProjectDatabase {
  return {
    variables: new Map(),
    bars: [],
    fbos: [],
    markers: [],
    folders: [
      { id: 1, name: 'textures', parent: 0, enabled: true },
      { id: 2, name: 'unused', parent: 0, enabled: true },
    ],
    files: [
      {
        id: 10,
        name: 'hero.png',
        parent: 1,
        bytes: 3,
        type: 'image/png',
        data: new Uint8Array([1, 2, 3]),
        format: 'png',
        enabled: true,
      },
      {
        id: 11,
        name: 'draft.png',
        parent: 2,
        bytes: 2,
        type: 'image/png',
        data: new Uint8Array([4, 5]),
        format: 'png',
        enabled: false,
      },
      {
        id: 12,
        name: 'root.txt',
        parent: 0,
        bytes: 1,
        type: 'text/plain',
        data: new Uint8Array([6]),
        format: 'txt',
        enabled: true,
      },
    ],
  };
}

describe('project pool sync', () => {
  it('collects only enabled pool files with their pool paths', () => {
    expect(collectPublishedPoolFiles(makeDb()).map((file) => [file.path, file.bytes])).toEqual([
      ['pool/root.txt', 1],
      ['pool/textures/hero.png', 3],
    ]);
  });

  it('copies missing or size-mismatched published files to Phoenix', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });
    const progress: ProjectPoolSyncProgress[] = [];

    const result = await syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: convergingFetch([
          { path: 'pool/root.txt', kind: 'file', size: 1 },
          { path: 'pool/textures/hero.png', kind: 'file', size: 99 },
      ]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, (next) => progress.push(next));

    expect(result).toEqual({ total: 2, copied: 2, skipped: 0, failed: 0 });
    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, undefined);
    expect(createDirectory).toHaveBeenCalledWith('pool', undefined);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledWith('pool/root.txt', new Uint8Array([6]), undefined);
    expect(writeFile).toHaveBeenCalledWith('pool/textures/hero.png', new Uint8Array([1, 2, 3]), undefined);
    expect(progress.at(-1)).toMatchObject({
      phase: 'complete',
      current: 2,
      total: 2,
      copied: 2,
      skipped: 0,
      failed: 0,
    });
  });

  it('skips all files when the Phoenix pool manifest matches exactly', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });

    const progress: ProjectPoolSyncProgress[] = [];
    const result = await syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: async () => manifest([
          { path: 'pool/root.txt', kind: 'file', size: 1, hash: fnv1a(new Uint8Array([6])) },
          { path: 'pool/textures/hero.png', kind: 'file', size: 3, hash: fnv1a(new Uint8Array([1, 2, 3])) },
          { path: 'resources/keep.frag', kind: 'file', size: 99 },
      ]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, (next) => progress.push(next));

    expect(result).toEqual({ total: 2, copied: 0, skipped: 2, failed: 0 });
    expect(deleteDirectory).not.toHaveBeenCalled();
    expect(createDirectory).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(progress.map((entry) => entry.phase)).toEqual(['scanning', 'complete']);
    expect(progress.at(-1)?.message).toBe('Phoenix pool already matches: 0 copied, 2 skipped.');
  });

  it('rebuilds the pool when a same-size file has different content', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });

    await syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: convergingFetch([
          { path: 'pool/root.txt', kind: 'file', size: 1, hash: fnv1a(new Uint8Array([9])) },
          { path: 'pool/textures/hero.png', kind: 'file', size: 3, hash: fnv1a(new Uint8Array([1, 2, 3])) },
      ]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {});

    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, undefined);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('clears Phoenix pool when it has extra files', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });

    const result = await syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: convergingFetch([
          { path: 'pool/root.txt', kind: 'file', size: 1 },
          { path: 'pool/textures/hero.png', kind: 'file', size: 3 },
          { path: 'pool/old-project/leftover.png', kind: 'file', size: 12 },
      ]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {});

    expect(result).toEqual({ total: 2, copied: 2, skipped: 0, failed: 0 });
    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, undefined);
    expect(createDirectory).toHaveBeenCalledWith('pool', undefined);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('clears Phoenix pool when the project has no published files but Phoenix has leftovers', async () => {
    const db = makeDb();
    db.files.forEach((file) => {
      file.enabled = false;
    });
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });

    const result = await syncPublishedPoolFilesToPhoenix(db, {
      fetchManifest: convergingFetch([
          { path: 'pool/old-project/leftover.png', kind: 'file', size: 12 },
      ], []),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {});

    expect(result).toEqual({ total: 0, copied: 0, skipped: 0, failed: 0 });
    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, undefined);
    expect(createDirectory).toHaveBeenCalledWith('pool', undefined);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('continues copying remaining files when one Phoenix write fails', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn()
      .mockRejectedValueOnce(new Error('network hiccup'))
      .mockResolvedValue({ ok: true, operation: 'write-file' });

    const result = await syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: convergingFetch([]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {});

    expect(result).toEqual({ total: 2, copied: 1, skipped: 0, failed: 1 });
    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, undefined);
    expect(createDirectory).toHaveBeenCalledWith('pool', undefined);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('stops before uploading when files remain after Phoenix accepts pool cleanup', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });
    const fetchManifest = vi.fn()
      .mockResolvedValueOnce(manifest([{ path: 'pool/old.txt', kind: 'file', size: 1, hash: 'fnv1a:00000000' }]))
      .mockResolvedValueOnce(manifest([{ path: 'pool/still-there.txt', kind: 'file', size: 1, hash: 'fnv1a:00000000' }]));

    await expect(syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest,
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {})).rejects.toThrow('Phoenix pool cleanup did not converge; first remaining file: pool/still-there.txt');

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects a rebuilt pool whose final manifest still differs', async () => {
    const createDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'create-directory' });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });
    const fetchManifest = vi.fn()
      .mockResolvedValueOnce(manifest([]))
      .mockResolvedValueOnce(manifest([]))
      .mockResolvedValueOnce(manifest([
        { path: 'pool/root.txt', kind: 'file', size: 1, hash: fnv1a(new Uint8Array([6])) },
      ]));

    await expect(syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest,
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {})).rejects.toThrow('Phoenix pool rebuild did not converge: missing file pool/textures/hero.png');
  });

  it('stops syncing when cancelled', async () => {
    const abortController = new AbortController();
    const createDirectory = vi.fn().mockImplementation(() => {
      abortController.abort(new DOMException('Pool sync cancelled.', 'AbortError'));
      return Promise.resolve({ ok: true, operation: 'create-directory' });
    });
    const deleteDirectory = vi.fn().mockResolvedValue({ ok: true, operation: 'delete-directory' });
    const writeFile = vi.fn().mockResolvedValue({ ok: true, operation: 'write-file' });

    await expect(syncPublishedPoolFilesToPhoenix(makeDb(), {
      fetchManifest: convergingFetch([]),
      createDirectory,
      deleteDirectory,
      writeFile,
    }, () => {}, { signal: abortController.signal })).rejects.toMatchObject({ name: 'AbortError' });

    expect(deleteDirectory).toHaveBeenCalledWith('pool', true, abortController.signal);
    expect(createDirectory).toHaveBeenCalledWith('pool', abortController.signal);
    expect(writeFile).not.toHaveBeenCalled();
  });
});

function fnv1a(value: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of value) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

function manifest(entries: AssetManifestEntry[]): AssetManifest {
  return {
    root: 'phoenix-engine',
    generatedAt: new Date().toISOString(),
    errors: [],
    entries,
  };
}

function matchingPoolEntries(): AssetManifestEntry[] {
  return [
    { path: 'pool/root.txt', kind: 'file', size: 1, hash: fnv1a(new Uint8Array([6])) },
    { path: 'pool/textures/hero.png', kind: 'file', size: 3, hash: fnv1a(new Uint8Array([1, 2, 3])) },
  ];
}

function convergingFetch(
  initialEntries: AssetManifestEntry[],
  finalEntries: AssetManifestEntry[] = matchingPoolEntries(),
): ReturnType<typeof vi.fn> {
  return vi.fn()
    .mockResolvedValueOnce(manifest(initialEntries))
    .mockResolvedValueOnce(manifest([]))
    .mockResolvedValueOnce(manifest(finalEntries));
}
