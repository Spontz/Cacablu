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
});

async function createLegacyProjectBytes(): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE "variables" ("variable" TEXT PRIMARY KEY, "value" TEXT)');
  db.run('CREATE TABLE "BARS" ("id" INTEGER PRIMARY KEY, "type" TEXT, "layer" INTEGER, "startTime" REAL, "endTime" REAL, "enabled" INTEGER, "selected" INTEGER, "script" TEXT, "srcBlending" TEXT, "dstBlending" TEXT, "blendingEQ" TEXT, "srcAlpha" TEXT, "dstAlpha" TEXT)');
  db.run('CREATE TABLE "FBOs" ("id" INTEGER PRIMARY KEY, "ratio" INTEGER, "width" INTEGER, "height" INTEGER, "format" TEXT, "colorAttachments" INTEGER, "filter" TEXT)');
  db.run('CREATE TABLE "FILES" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "bytes" INTEGER, "type" TEXT, "data" BLOB, "format" TEXT, "enabled" INTEGER)');
  db.run('CREATE TABLE "FOLDERS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "enabled" INTEGER)');
  const bytes = db.export();
  db.close();
  return bytes;
}
