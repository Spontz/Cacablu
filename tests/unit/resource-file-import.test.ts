import { describe, expect, it, vi } from 'vitest';

import type { AssetOperationResult } from '../../src/phoenix/asset-client';
import type { PhoenixSectionSyncResult } from '../../src/phoenix/section-client';
import type { DbBar, DbFile, ProjectDatabase } from '../../src/db/db-schema';
import { createAppState } from '../../src/state/app-state';
import {
  findResourceImportConflict,
  syncImportedResourceFileToPhoenix,
} from '../../src/services/resource-file-import';

const file: DbFile = {
  id: 4,
  name: 'hero.png',
  parent: 2,
  bytes: 3,
  type: 'image/png',
  data: new Uint8Array([7, 8, 9]),
  format: 'png',
  enabled: true,
};

const bar = (id: number): DbBar => ({
  id,
  name: '',
  type: 'drawImage',
  layer: id,
  startTime: 0,
  endTime: 1,
  enabled: true,
  selected: false,
  script: 'filename=/pool/textures/hero.png',
  srcBlending: 'ONE',
  dstBlending: 'ZERO',
  blendingEQ: 'ADD',
  srcAlpha: '',
  dstAlpha: '',
});

function database(): ProjectDatabase {
  return {
    variables: new Map(),
    bars: [bar(11), bar(12)],
    fbos: [],
    files: [file],
    folders: [{ id: 2, name: 'textures', parent: 0, enabled: true }],
    markers: [],
  };
}

function assetResult(overrides: Partial<AssetOperationResult> = {}): AssetOperationResult {
  return {
    requestId: 'asset-import',
    ok: true,
    operation: 'write-file',
    failedSections: [],
    deactivatedSections: [],
    reloadedSections: [],
    ...overrides,
  };
}

function sectionResult(): PhoenixSectionSyncResult {
  return {
    requestId: 'section-import',
    ok: true,
    operation: 'update-one',
    received: 1,
    loaded: 1,
    failed: 0,
    writtenFiles: 1,
    deletedFiles: [],
    failedSections: [],
  };
}

describe('Pool file import conflicts', () => {
  it('finds same-folder file conflicts case-insensitively', () => {
    expect(findResourceImportConflict(database(), 2, 'HERO.PNG')).toEqual({ kind: 'file', file });
  });

  it('distinguishes a conflicting folder from a replaceable file', () => {
    const db = database();
    db.files = [];
    db.folders.push({ id: 3, name: 'hero.png', parent: 2, enabled: true });
    expect(findResourceImportConflict(db, 2, 'Hero.PNG')).toEqual({
      kind: 'folder',
      folder: db.folders[1],
    });
  });
});

describe('imported Pool file synchronization', () => {
  it('writes the replacement before updating every unique referencing bar', async () => {
    const calls: string[] = [];
    const writeFile = vi.fn(async () => {
      calls.push('write-file');
      return assetResult();
    });
    const replaceOne = vi.fn(async (section: { id: string }) => {
      calls.push(`bar-${section.id}`);
      return sectionResult();
    });

    const result = await syncImportedResourceFileToPhoenix(
      database(),
      file,
      'pool/textures/hero.png',
      [11, 12, 11],
      { writeFile },
      { replaceOne },
      createAppState(),
      true,
    );

    expect(calls).toEqual(['write-file', 'bar-11', 'bar-12']);
    expect(writeFile).toHaveBeenCalledWith(
      'pool/textures/hero.png',
      new Uint8Array([7, 8, 9]),
      undefined,
      { reloadSections: false },
    );
    expect(result).toEqual({ written: true, syncedBarIds: [11, 12], failedBarIds: [] });
  });

  it('does not update bars when Phoenix rejects the file replacement', async () => {
    const replaceOne = vi.fn();
    await expect(syncImportedResourceFileToPhoenix(
      database(),
      file,
      'pool/textures/hero.png',
      [11, 12],
      { writeFile: vi.fn().mockResolvedValue(assetResult({ ok: false, message: 'write rejected' })) },
      { replaceOne },
      createAppState(),
      true,
    )).rejects.toThrow('write rejected');
    expect(replaceOne).not.toHaveBeenCalled();
  });

  it('keeps disabled replacements local and does not contact Phoenix', async () => {
    const writeFile = vi.fn();
    const replaceOne = vi.fn();
    const result = await syncImportedResourceFileToPhoenix(
      database(),
      { ...file, enabled: false },
      'pool/textures/hero.png',
      [11],
      { writeFile },
      { replaceOne },
      createAppState(),
      true,
    );
    expect(result).toEqual({ written: false, syncedBarIds: [], failedBarIds: [] });
    expect(writeFile).not.toHaveBeenCalled();
    expect(replaceOne).not.toHaveBeenCalled();
  });
});
