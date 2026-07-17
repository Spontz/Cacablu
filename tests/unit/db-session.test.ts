import path from 'node:path';
import { fileURLToPath } from 'node:url';

import initSqlJs from 'sql.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/sql-loader', () => {
  let pending: ReturnType<typeof initSqlJs> | null = null;
  return {
    getSqlJs: () => {
      pending ??= initSqlJs({
        locateFile: () => path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '../../node_modules/sql.js/dist/sql-wasm.wasm',
        ),
      });
      return pending;
    },
  };
});

import { openDbSession } from '../../src/db/db-session';
import { getSqlJs } from '../../src/db/sql-loader';
import { captureAssetRoots } from '../../src/resources/asset-clipboard';

class MemoryFileHandle {
  readonly name = 'project.sqlite';

  constructor(private bytes: Uint8Array) {}

  async getFile(): Promise<File> {
    return new File([this.bytes.slice()], this.name, { type: 'application/x-sqlite3' });
  }

  async createWritable(): Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> {
    return {
      write: async (blob: Blob) => {
        this.bytes = new Uint8Array(await blob.arrayBuffer());
      },
      close: async () => {},
    };
  }
}

describe('DbSession markers', () => {
  it('migrates old databases and persists marker CRUD changes', async () => {
    const handle = new MemoryFileHandle(await createLegacyProjectBytes()) as unknown as FileSystemFileHandle;
    let session = await openDbSession(handle);

    expect(session.data.markers).toEqual([]);
    expect(session.getTableNames()).toContain('MARKERS');
    expect(session.getTableNames()).not.toContain('markers');
    expect(session.getTableNames()).toContain('custom_debug');
    expect(session.getTableSnapshot('custom_debug')).toEqual({
      name: 'custom_debug',
      columns: ['id', 'note'],
      rows: [{ id: 1, note: 'visible' }],
    });

    const later = session.insertTimelineMarker({ time: 20, label: 'Later' });
    const earlier = session.insertTimelineMarker({ time: 10, label: 'Earlier' });
    expect(session.data.markers.map((marker) => marker.id)).toEqual([earlier.id, later.id]);

    session.updateTimelineMarker(later.id, { time: 5, label: 'Start' });
    expect(session.data.markers.map((marker) => [marker.id, marker.time, marker.label])).toEqual([
      [later.id, 5, 'Start'],
      [earlier.id, 10, 'Earlier'],
    ]);

    const deleted = session.deleteTimelineMarker(earlier.id);
    expect(session.data.markers.map((marker) => marker.id)).toEqual([later.id]);

    const restored = session.restoreTimelineMarker(deleted);
    expect(restored).toEqual(deleted);
    expect(session.data.markers.map((marker) => [marker.id, marker.time, marker.label])).toEqual([
      [later.id, 5, 'Start'],
      [earlier.id, 10, 'Earlier'],
    ]);

    await session.save();
    session.close();

    session = await openDbSession(handle);
    expect(session.data.markers.map((marker) => [marker.id, marker.time, marker.label])).toEqual([
      [later.id, 5, 'Start'],
      [earlier.id, 10, 'Earlier'],
    ]);
    session.close();
  });

  it('renames lowercase marker tables to uppercase MARKERS while preserving rows', async () => {
    const handle = new MemoryFileHandle(await createLowercaseMarkersProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);

    expect(session.getTableNames()).toContain('MARKERS');
    expect(session.getTableNames()).not.toContain('markers');
    expect(session.getTableSnapshot('MARKERS')).toEqual({
      name: 'MARKERS',
      columns: ['id', 'time', 'label'],
      rows: [{ id: 1, time: 12.5, label: 'legacy' }],
    });
    expect(session.data.markers).toEqual([{ id: 1, time: 12.5, label: 'legacy' }]);
    session.close();
  });
});

describe('DbSession timeline bar deletion', () => {
  it('deletes and atomically restores complete bars with stable ids', async () => {
    const handle = new MemoryFileHandle(await createLegacyProjectBytes()) as unknown as FileSystemFileHandle;
    let session = await openDbSession(handle);
    const first = session.insertTimelineBar({
      name: 'first',
      type: 'drawImage',
      layer: 3,
      startTime: 1.25,
      endTime: 9.75,
      enabled: true,
      selected: true,
      script: 'image /pool/first.png',
      srcBlending: 'SRC_ALPHA',
      dstBlending: 'ONE_MINUS_SRC_ALPHA',
      blendingEQ: 'ADD',
      srcAlpha: 'ONE',
      dstAlpha: 'ZERO',
    });
    const second = session.insertTimelineBar({
      name: 'second',
      type: 'drawVideo',
      layer: 7,
      startTime: 10,
      endTime: 20,
      enabled: false,
      selected: false,
      script: 'video /pool/second.mp4',
      srcBlending: 'ONE',
      dstBlending: 'ZERO',
      blendingEQ: 'MAX',
      srcAlpha: 'SRC_ALPHA',
      dstAlpha: 'DST_ALPHA',
    });

    const deleted = session.deleteTimelineBars([second.id, first.id]);
    expect(session.data.bars).toEqual([]);
    expect(deleted).toEqual([first, second]);

    const restored = session.restoreTimelineBars(deleted);
    expect(restored).toEqual([first, second]);
    expect(session.data.bars).toEqual([first, second]);

    await session.save();
    session.close();
    session = await openDbSession(handle);
    expect(session.data.bars).toEqual([first, second]);
    session.close();
  });

  it('rejects a conflicting restore without partially restoring other deleted bars', async () => {
    const handle = new MemoryFileHandle(await createLegacyProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const first = session.insertTimelineBar({ id: 10, layer: 1, startTime: 0, endTime: 1 });
    const second = session.insertTimelineBar({ id: 11, layer: 2, startTime: 1, endTime: 2 });
    const deleted = session.deleteTimelineBars([first.id, second.id]);
    session.insertTimelineBar({ ...first, name: 'replacement' });

    expect(() => session.restoreTimelineBars(deleted)).toThrow('bar 10 already exists');
    expect(session.data.bars.map((bar) => [bar.id, bar.name])).toEqual([[10, 'replacement']]);
    expect(session.getTableSnapshot('BARS').rows.map((row) => row.id)).toEqual([10]);
    session.close();
  });
});

describe('DbSession Pool clipboard mutations', () => {
  it('copies only a root file into the selected folder', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const rootFile = session.upsertResourceFile({
      name: 'root.txt',
      parent: 0,
      bytes: 4,
      type: 'text/plain',
      data: new TextEncoder().encode('root'),
      format: 'txt',
      enabled: true,
    });
    const folderCount = session.data.folders.length;
    const roots = captureAssetRoots(session.data, [{
      kind: 'file',
      id: rootFile.id,
      name: rootFile.name,
      fileType: rootFile.type,
    }]);

    const result = session.copyResourceItems(roots, 10);
    expect(result.roots).toEqual([{ kind: 'file', id: expect.any(Number) }]);
    expect(result.files.map((entry) => entry.newPath)).toEqual(['/pool/destination/root.txt']);
    expect(session.data.folders).toHaveLength(folderCount);
    session.close();
  });

  it('copies and moves items into the Pool root', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const fileRoot = captureAssetRoots(session.data, [{ kind: 'file', id: 3, name: 'hero.png', fileType: 'image/png' }]);

    const copyResult = session.copyResourceItems(fileRoot, 0);
    expect(copyResult.files.map((entry) => entry.newPath)).toEqual(['/pool/hero.png']);
    expect(copyResult.files[0].file.parent).toBe(0);

    const moveResult = session.moveResourceItems([{ kind: 'folder', id: 2 }], 0);
    expect(moveResult.files.map((entry) => entry.newPath)).toEqual(['/pool/nested/note.txt']);
    expect(session.data.folders.find((folder) => folder.id === 2)?.parent).toBe(0);
    session.close();
  });

  it('copies nested folders atomically and persists new ids and contents', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    let session = await openDbSession(handle);
    const roots = captureAssetRoots(session.data, [{ kind: 'folder', id: 1, name: 'textures' }]);

    const result = session.copyResourceItems(roots, 10);
    expect(result.operation).toBe('copy');
    expect(result.roots).toHaveLength(1);
    expect(result.files.map((entry) => [entry.file.name, entry.newPath])).toEqual([
      ['note.txt', '/pool/destination/textures/nested/note.txt'],
      ['hero.png', '/pool/destination/textures/hero.png'],
    ]);
    expect(result.files[0].file.data).not.toBe(session.data.files.find((file) => file.id === 4)?.data);

    await session.save();
    session.close();
    session = await openDbSession(handle);
    expect(session.data.folders.some((folder) => folder.name === 'textures' && folder.parent === 10 && folder.id !== 1)).toBe(true);
    expect(session.data.files.some((file) => file.name === 'note.txt' && file.id !== 4 && [...file.data].join(',') === '3')).toBe(true);
    session.close();
  });

  it('moves files and folders while preserving ids and descendant relationships', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);

    const result = session.moveResourceItems([{ kind: 'folder', id: 1 }], 10);
    expect(result.files.map((entry) => [entry.file.id, entry.oldPath, entry.newPath])).toEqual([
      [3, '/pool/textures/hero.png', '/pool/destination/textures/hero.png'],
      [4, '/pool/textures/nested/note.txt', '/pool/destination/textures/nested/note.txt'],
    ]);
    expect(session.data.folders.find((folder) => folder.id === 1)?.parent).toBe(10);
    expect(session.data.folders.find((folder) => folder.id === 2)?.parent).toBe(1);
    session.close();
  });

  it('atomically restores Cut/Paste roots to different original parents', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    session.moveResourceItems([{ kind: 'file', id: 3 }, { kind: 'file', id: 4 }], 10);
    const restored = session.moveResourceItemsToParents([
      { kind: 'file', id: 3, parentId: 1 },
      { kind: 'file', id: 4, parentId: 2 },
    ]);

    expect(restored.files.map((entry) => [entry.file.id, entry.newPath])).toEqual([
      [3, '/pool/textures/hero.png'],
      [4, '/pool/textures/nested/note.txt'],
    ]);
    expect(session.data.files.find((file) => file.id === 3)?.parent).toBe(1);
    expect(session.data.files.find((file) => file.id === 4)?.parent).toBe(2);
    session.close();
  });

  it('rejects conflicts, same-parent moves, and descendant cycles without mutation', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const beforeFolders = session.data.folders.map((folder) => ({ ...folder }));
    const beforeFiles = session.data.files.map((file) => ({ ...file, data: [...file.data] }));

    const fileRoot = captureAssetRoots(session.data, [{ kind: 'file', id: 3, name: 'hero.png', fileType: 'image/png' }]);
    expect(() => session.copyResourceItems(fileRoot, 1)).toThrow('already exists');
    expect(() => session.moveResourceItems([{ kind: 'file', id: 3 }], 1)).toThrow('already in');
    expect(() => session.moveResourceItems([{ kind: 'folder', id: 1 }], 2)).toThrow('descendant');
    expect(session.data.folders).toEqual(beforeFolders);
    expect(session.data.files.map((file) => ({ ...file, data: [...file.data] }))).toEqual(beforeFiles);
    session.close();
  });

  it('rolls back SQL and in-memory rows when a recursive insert fails', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const folderCount = session.data.folders.length;
    const fileCount = session.data.files.length;
    const badFile = {
      kind: 'file' as const,
      sourceId: 99,
      name: 'bad.bin',
      path: '/pool/bad.bin',
      bytes: 1,
      type: 'application/octet-stream',
      format: 'bin',
      enabled: true,
    } as Record<string, unknown>;
    Object.defineProperty(badFile, 'data', { get: () => { throw new Error('Synthetic insert failure.'); } });

    expect(() => session.copyResourceItems([
      {
        kind: 'file', sourceId: 98, name: 'ok.bin', path: '/pool/ok.bin', bytes: 1,
        type: 'application/octet-stream', data: new Uint8Array([1]), format: 'bin', enabled: true,
      },
      badFile as never,
    ], 10)).toThrow('Synthetic insert failure');
    expect(session.data.folders).toHaveLength(folderCount);
    expect(session.data.files).toHaveLength(fileCount);
    expect(session.getTableSnapshot('FILES').rows).toHaveLength(fileCount);
    session.close();
  });

  it('rejects Copy/Paste undo when the pasted subtree gained later content', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const roots = captureAssetRoots(session.data, [{ kind: 'folder', id: 1, name: 'textures' }]);
    const copied = session.copyResourceItems(roots, 10);
    const expected = session.snapshotResourceItems(copied.roots);
    const pastedFolder = copied.roots[0];
    if (pastedFolder.kind !== 'folder') throw new Error('Expected copied folder.');
    session.upsertResourceFile({
      name: 'later.txt', parent: pastedFolder.id, bytes: 1, type: 'text/plain',
      data: new Uint8Array([9]), format: 'txt', enabled: true,
    });

    expect(() => session.deleteResourceItems(copied.roots, expected)).toThrow('changed afterwards');
    expect(session.data.folders.some((folder) => folder.id === pastedFolder.id)).toBe(true);
    expect(session.data.files.some((file) => file.name === 'later.txt' && file.parent === pastedFolder.id)).toBe(true);
    session.close();
  });
});

describe('DbSession Pool item actions', () => {
  it('creates validated root and nested folders and persists them', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    let session = await openDbSession(handle);
    const root = session.createResourceFolder(0, '  shaders  ');
    const nested = session.createResourceFolder(root.id, 'includes');

    expect(root.name).toBe('shaders');
    expect(nested.parent).toBe(root.id);
    expect(() => session.createResourceFolder(0, 'SHADERS')).toThrow('already exists');
    expect(() => session.createResourceFolder(0, '..')).toThrow('cannot be');
    expect(() => session.createResourceFolder(0, 'bad/name')).toThrow('separators');

    await session.save();
    session.close();
    session = await openDbSession(handle);
    expect(session.data.folders.some((folder) => folder.id === nested.id && folder.parent === root.id)).toBe(true);
    session.close();
  });

  it('renames files and folders while rewriting only exact Pool path references', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const bar = session.insertTimelineBar({
      layer: 0,
      startTime: 0,
      endTime: 1,
      script: 'file /pool/textures/hero.png\nbackup /pool/textures/hero.png.backup\nnested /pool/textures/nested/note.txt',
    });

    expect(session.findResourceScriptReferences({ kind: 'file', id: 3 })).toEqual([{ barId: bar.id, occurrences: 1 }]);
    const fileRename = session.renameResourceItem({ kind: 'file', id: 3 }, 'main.png', true);
    expect(fileRename.oldPath).toBe('/pool/textures/hero.png');
    expect(fileRename.newPath).toBe('/pool/textures/main.png');
    expect(session.data.bars[0].script).toContain('/pool/textures/main.png');
    expect(session.data.bars[0].script).toContain('/pool/textures/hero.png.backup');

    const folderRename = session.renameResourceItem({ kind: 'folder', id: 1 }, 'assets', true);
    expect(folderRename.files.map((entry) => entry.newPath)).toEqual([
      '/pool/assets/main.png',
      '/pool/assets/nested/note.txt',
    ]);
    expect(session.data.bars[0].script).toContain('/pool/assets/nested/note.txt');
    expect(() => session.renameResourceItem({ kind: 'folder', id: 1 }, 'DESTINATION', false)).toThrow('already exists');
    session.restoreResourceRename(folderRename);
    session.restoreResourceRename(fileRename);
    expect(session.data.files.find((file) => file.id === 3)?.name).toBe('hero.png');
    expect(session.data.bars[0].script).toBe(bar.script);
    session.close();
  });

  it('rejects rename undo atomically when an affected script changed afterwards', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const bar = session.insertTimelineBar({
      layer: 0, startTime: 0, endTime: 1, script: 'file /pool/textures/hero.png',
    });
    const renamed = session.renameResourceItem({ kind: 'file', id: 3 }, 'main.png', true);
    session.updateCell('BARS', bar.id, 'script', `${bar.script}\nchanged later`);

    expect(() => session.restoreResourceRename(renamed)).toThrow('changed afterwards');
    expect(session.data.files.find((file) => file.id === 3)?.name).toBe('main.png');
    session.close();
  });

  it('deletes and restores a complete subtree with exact ids, bytes and positions', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    let session = await openDbSession(handle);
    const beforeFolders = session.data.folders.map((folder) => ({ ...folder }));
    const beforeFiles = session.data.files.map((file) => ({ ...file, data: [...file.data] }));
    const deleted = session.deleteResourceItems([{ kind: 'folder', id: 1 }]);

    expect(deleted.folders.map((entry) => entry.row.id)).toEqual([1, 2]);
    expect(deleted.files.map((entry) => entry.path)).toEqual([
      '/pool/textures/hero.png',
      '/pool/textures/nested/note.txt',
    ]);
    expect(session.data.folders.some((folder) => folder.id === 1)).toBe(false);

    session.restoreResourceItems(deleted);
    expect(session.data.folders).toEqual(beforeFolders);
    expect(session.data.files.map((file) => ({ ...file, data: [...file.data] }))).toEqual(beforeFiles);

    await session.save();
    session.close();
    session = await openDbSession(handle);
    expect(session.data.files.find((file) => file.id === 3)?.data).toEqual(new Uint8Array([1, 2]));
    session.close();
  });

  it('rejects conflicting restoration without partially restoring a subtree', async () => {
    const handle = new MemoryFileHandle(await createResourceProjectBytes()) as unknown as FileSystemFileHandle;
    const session = await openDbSession(handle);
    const deleted = session.deleteResourceItems([{ kind: 'folder', id: 1 }]);
    session.createResourceFolder(0, 'TEXTURES');
    const before = session.data.folders.map((folder) => ({ ...folder }));

    expect(() => session.restoreResourceItems(deleted)).toThrow('already exists');
    expect(session.data.folders).toEqual(before);
    expect(session.data.files.some((file) => file.id === 3)).toBe(false);
    session.close();
  });
});

async function createLegacyProjectBytes(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE "variables" ("variable" TEXT PRIMARY KEY, "value" TEXT)');
  db.run('CREATE TABLE "BARS" ("id" INTEGER PRIMARY KEY, "type" TEXT, "layer" INTEGER, "startTime" REAL, "endTime" REAL, "enabled" INTEGER, "selected" INTEGER, "script" TEXT, "srcBlending" TEXT, "dstBlending" TEXT, "blendingEQ" TEXT, "srcAlpha" TEXT, "dstAlpha" TEXT)');
  db.run('CREATE TABLE "FBOs" ("id" INTEGER PRIMARY KEY, "ratio" INTEGER, "width" INTEGER, "height" INTEGER, "format" TEXT, "colorAttachments" INTEGER, "filter" TEXT)');
  db.run('CREATE TABLE "FILES" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "bytes" INTEGER, "type" TEXT, "data" BLOB, "format" TEXT, "enabled" INTEGER)');
  db.run('CREATE TABLE "FOLDERS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "enabled" INTEGER)');
  db.run('CREATE TABLE "custom_debug" ("id" INTEGER PRIMARY KEY, "note" TEXT)');
  db.run('INSERT INTO "custom_debug" ("note") VALUES (?)', ['visible']);
  const bytes = db.export();
  db.close();
  return bytes;
}

async function createLowercaseMarkersProjectBytes(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE "variables" ("variable" TEXT PRIMARY KEY, "value" TEXT)');
  db.run('CREATE TABLE "BARS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "type" TEXT, "layer" INTEGER, "startTime" REAL, "endTime" REAL, "enabled" INTEGER, "selected" INTEGER, "script" TEXT, "srcBlending" TEXT, "dstBlending" TEXT, "blendingEQ" TEXT, "srcAlpha" TEXT, "dstAlpha" TEXT)');
  db.run('CREATE TABLE "FBOs" ("id" INTEGER PRIMARY KEY, "ratio" INTEGER, "width" INTEGER, "height" INTEGER, "format" TEXT, "colorAttachments" INTEGER, "filter" TEXT)');
  db.run('CREATE TABLE "FILES" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "bytes" INTEGER, "type" TEXT, "data" BLOB, "format" TEXT, "enabled" INTEGER)');
  db.run('CREATE TABLE "FOLDERS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "enabled" INTEGER)');
  db.run('CREATE TABLE "markers" ("id" INTEGER PRIMARY KEY, "time" REAL NOT NULL, "label" TEXT NOT NULL DEFAULT "")');
  db.run('INSERT INTO "markers" ("time", "label") VALUES (?, ?)', [12.5, 'legacy']);
  const bytes = db.export();
  db.close();
  return bytes;
}

async function createResourceProjectBytes(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database(await createLegacyProjectBytes());
  db.run('INSERT INTO "FOLDERS" ("id", "name", "parent", "enabled") VALUES (?, ?, ?, ?)', [1, 'textures', 0, 1]);
  db.run('INSERT INTO "FOLDERS" ("id", "name", "parent", "enabled") VALUES (?, ?, ?, ?)', [2, 'nested', 1, 1]);
  db.run('INSERT INTO "FOLDERS" ("id", "name", "parent", "enabled") VALUES (?, ?, ?, ?)', [10, 'destination', 0, 1]);
  db.run('INSERT INTO "FILES" ("id", "name", "parent", "bytes", "type", "data", "format", "enabled") VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    3, 'hero.png', 1, 2, 'image/png', new Uint8Array([1, 2]), 'png', 1,
  ]);
  db.run('INSERT INTO "FILES" ("id", "name", "parent", "bytes", "type", "data", "format", "enabled") VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    4, 'note.txt', 2, 1, 'text/plain', new Uint8Array([3]), 'txt', 0,
  ]);
  const bytes = db.export();
  db.close();
  return bytes;
}
