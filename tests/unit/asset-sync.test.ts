import { describe, expect, it } from 'vitest';

import { buildLocalAssetManifest, compareAssetManifests, type AssetDirectoryEntryHandle, type AssetDirectoryHandle } from '../../src/phoenix/asset-manifest';
import { deleteAllowedAssetDirectory, deleteAllowedAssetFile, writeAllowedAssetFile } from '../../src/phoenix/asset-operations';
import { normalizeAssetPath } from '../../src/phoenix/asset-paths';

interface MemoryDirectory extends AssetDirectoryHandle {
  directories: Map<string, MemoryDirectory>;
  files: Map<string, number[] | string>;
}

function createMemoryDirectory(name: string): MemoryDirectory {
  const directory: MemoryDirectory = {
    name,
    kind: 'directory',
    directories: new Map(),
    files: new Map(),

    async getDirectoryHandle(childName) {
      const existing = directory.directories.get(childName);
      if (!existing) throw new Error(`Missing directory ${childName}`);
      return existing;
    },

    async *values() {
      const entries: AssetDirectoryEntryHandle[] = [
        ...directory.directories.values(),
        ...[...directory.files.keys()].map((fileName) => ({
          name: fileName,
          kind: 'file' as const,
          async getFile() {
            const value = directory.files.get(fileName);
            return typeof value === 'string' ? new Blob([value]) : new Blob([new Uint8Array(value ?? [])]);
          },
        })),
      ];

      for (const entry of entries) yield entry;
    },
  };

  return directory;
}

describe('normalizeAssetPath', () => {
  it('allows pool and resources paths and normalizes separators', () => {
    expect(normalizeAssetPath('pool\\shaders\\basic.glsl')).toEqual({
      root: 'pool',
      path: 'pool/shaders/basic.glsl',
    });
    expect(normalizeAssetPath('/resources//textures/icon.png')).toEqual({
      root: 'resources',
      path: 'resources/textures/icon.png',
    });
  });

  it('rejects config, absolute, and traversal paths', () => {
    expect(normalizeAssetPath('config/control.spo')).toBeNull();
    expect(normalizeAssetPath('C:/demo/data/pool/file.txt')).toBeNull();
    expect(normalizeAssetPath('pool/../config/control.spo')).toBeNull();
  });
});

describe('asset manifests', () => {
  it('scans only pool and resources and reports changed files', async () => {
    const data = createMemoryDirectory('data');
    const pool = createMemoryDirectory('pool');
    const resources = createMemoryDirectory('resources');
    const shaders = createMemoryDirectory('shaders');

    pool.files.set('local.txt', [1, 2, 3]);
    shaders.files.set('basic.glsl', 'shader');
    resources.directories.set('shaders', shaders);
    data.directories.set('pool', pool);
    data.directories.set('resources', resources);

    const local = await buildLocalAssetManifest(data);
    expect(local.errors).toEqual([]);
    expect(local.entries.map((entry) => entry.path)).toEqual([
      'pool',
      'pool/local.txt',
      'resources',
      'resources/shaders',
      'resources/shaders/basic.glsl',
    ]);

    const changed = compareAssetManifests(local, {
      root: 'phoenix-engine',
      generatedAt: new Date().toISOString(),
      errors: [],
      entries: local.entries.map((entry) => entry.path === 'pool/local.txt'
        ? { ...entry, size: 99, hash: 'fnv1a:different' }
        : entry),
    });

    expect(changed).toEqual([
      expect.objectContaining({
        path: 'pool/local.txt',
        kind: 'changed',
      }),
    ]);
  });
});

describe('asset operations', () => {
  it('blocks out-of-scope write operations before calling Phoenix', async () => {
    const calls: string[] = [];
    const client = {
      async writeFile(path: string) {
        calls.push(path);
        return { requestId: 'test', ok: true, operation: 'write-file' as const };
      },
    };

    await expect(writeAllowedAssetFile(client, 'config/control.spo', new Uint8Array())).rejects.toThrow('pool or resources');
    await expect(writeAllowedAssetFile(client, 'pool/../config/control.spo', new Uint8Array())).rejects.toThrow('pool or resources');

    expect(calls).toEqual([]);
  });

  it('blocks out-of-scope delete operations before calling Phoenix', async () => {
    const calls: string[] = [];
    const client = {
      async deleteFile(path: string) {
        calls.push(path);
        return { requestId: 'test', ok: true, operation: 'delete-file' as const };
      },
    };

    await expect(deleteAllowedAssetFile(client, 'config/control.spo')).rejects.toThrow('pool or resources');
    await expect(deleteAllowedAssetFile(client, 'resources/../config/control.spo')).rejects.toThrow('pool or resources');

    expect(calls).toEqual([]);
  });

  it('blocks out-of-scope delete directory operations before calling Phoenix', async () => {
    const calls: string[] = [];
    const client = {
      async deleteDirectory(path: string, recursive: boolean) {
        calls.push(`${path}:${recursive}`);
        return { requestId: 'test', ok: true, operation: 'delete-directory' as const };
      },
    };

    await expect(deleteAllowedAssetDirectory(client, 'config/cache', true)).rejects.toThrow('pool or resources');
    await expect(deleteAllowedAssetDirectory(client, 'pool/../config/cache', true)).rejects.toThrow('pool or resources');

    expect(calls).toEqual([]);
  });
});
