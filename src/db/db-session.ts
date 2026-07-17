import { getSqlJs } from './sql-loader';
import type { SqlDatabase } from './sql-loader';
import { readDatabase } from './db-reader';
import { serializeDatabase } from './db-writer';
import type { DbBar, DbFbo, DbFile, DbFolder, DbMarker, ProjectDatabase } from './db-schema';
import { buildResourcePath, type AssetClipboardNode } from '../resources/asset-clipboard';

type EditableDbValue = string | number | boolean | null;
type DbTableName = string;
type DbTableCellValue = string | number | boolean | Uint8Array | null;
type NewTimelineBar = Pick<DbBar, 'layer' | 'startTime' | 'endTime'> & Partial<Omit<DbBar, 'layer' | 'startTime' | 'endTime'>>;
type NewTimelineMarker = Pick<DbMarker, 'time'> & Partial<Pick<DbMarker, 'id' | 'label'>>;
type NewResourceFile = Pick<DbFile, 'name' | 'parent' | 'bytes' | 'type' | 'data' | 'format'> & Partial<Pick<DbFile, 'enabled'>>;
type NewResourceFolder = Pick<DbFolder, 'name' | 'parent'> & Partial<Pick<DbFolder, 'enabled'>>;
type GraphicsContextUpdate = {
  colorDepth: number;
  width: number;
  height: number;
  fullscreen: boolean;
  vsync: boolean;
  targetFps: number | null;
};
type GraphicsFboUpdate = Pick<DbFbo, 'id' | 'ratio' | 'width' | 'height' | 'format' | 'colorAttachments' | 'filter'>;
type DemoSettingsUpdate = {
  demoName: string;
  loop: boolean;
  sound: boolean;
  debugGrid: boolean;
  logDetail: number;
};

// First 16 bytes of any valid SQLite file: "SQLite format 3\0"
const SQLITE_MAGIC = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]);

export interface DbSession {
  readonly fileName: string;
  readonly data: ProjectDatabase;
  updateCell(tableName: DbTableName, rowKey: string | number, columnName: string, value: EditableDbValue): void;
  getTableNames(): string[];
  getTableSnapshot(tableName: string): DbTableSnapshot;
  insertTimelineBar(input: NewTimelineBar): DbBar;
  deleteTimelineBars(ids: number[]): DbBar[];
  restoreTimelineBars(bars: DbBar[]): DbBar[];
  setTimelineBarEnabled(barId: number, enabled: boolean): DbBar;
  insertTimelineMarker(input: NewTimelineMarker): DbMarker;
  updateTimelineMarker(markerId: number, input: Partial<Pick<DbMarker, 'time' | 'label'>>): DbMarker;
  deleteTimelineMarker(markerId: number): DbMarker;
  restoreTimelineMarker(marker: DbMarker): DbMarker;
  upsertResourceFile(input: NewResourceFile): DbFile;
  insertResourceFolder(input: NewResourceFolder): DbFolder;
  createResourceFolder(parentId: number, name: string): DbFolder;
  renameResourceItem(item: ResourceItemRef, name: string, updateScriptPaths: boolean): ResourceRenameMutation;
  restoreResourceRename(mutation: ResourceRenameMutation): ResourceRenameMutation;
  findResourceScriptReferences(item: ResourceItemRef): ResourceScriptReference[];
  moveResourceFile(fileId: number, parentId: number): DbFile;
  copyResourceItems(roots: AssetClipboardNode[], parentId: number): ResourceClipboardMutation;
  moveResourceItems(roots: ResourceItemRef[], parentId: number): ResourceClipboardMutation;
  moveResourceItemsToParents(roots: ResourceParentRestore[]): ResourceClipboardMutation;
  updateResourceFileContent(fileId: number, input: Pick<DbFile, 'bytes' | 'type' | 'data' | 'format'>): DbFile;
  setResourceFileEnabled(fileId: number, enabled: boolean): DbFile;
  deleteResourceFile(fileId: number): DbFile;
  deleteResourceFolder(folderId: number): { folders: DbFolder[]; files: DbFile[] };
  snapshotResourceItems(roots: ResourceItemRef[]): ResourceDeletionSnapshot;
  deleteResourceItems(roots: ResourceItemRef[], expected?: ResourceDeletionSnapshot): ResourceDeletionSnapshot;
  restoreResourceItems(snapshot: ResourceDeletionSnapshot): ResourceClipboardMutation;
  updateGraphicsConfig(context: GraphicsContextUpdate, fbos: GraphicsFboUpdate[]): void;
  updateDemoSettings(settings: DemoSettingsUpdate): void;
  save(): Promise<void>;
  saveAs(handle: FileSystemFileHandle): Promise<DbSession>;
  close(): void;
}

export interface ResourceItemRef {
  kind: 'file' | 'folder';
  id: number;
}

export interface ResourceParentRestore extends ResourceItemRef {
  parentId: number;
}

export interface ResourceFileMutation {
  file: DbFile;
  oldPath?: string;
  newPath: string;
}

export interface ResourceClipboardMutation {
  operation: 'copy' | 'move';
  roots: ResourceItemRef[];
  files: ResourceFileMutation[];
}

export interface ResourceScriptReference {
  barId: number;
  occurrences: number;
}

export interface ResourceScriptEdit {
  barId: number;
  before: string;
  after: string;
}

export interface ResourceRenameMutation {
  item: ResourceItemRef;
  oldName: string;
  newName: string;
  oldPath: string;
  newPath: string;
  files: ResourceFileMutation[];
  scripts: ResourceScriptEdit[];
}

export interface ResourceDeletionSnapshot {
  roots: ResourceItemRef[];
  folders: Array<{ row: DbFolder; index: number }>;
  files: Array<{ row: DbFile; index: number; path: string }>;
}

export interface DbTableSnapshot {
  name: string;
  columns: string[];
  rows: Array<Record<string, DbTableCellValue>>;
}

export interface DbSessionRef {
  current: DbSession | null;
}

export function createDbSessionRef(): DbSessionRef {
  return { current: null };
}

export async function openDbSession(handle: FileSystemFileHandle): Promise<DbSession> {
  const file = await handle.getFile();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!SQLITE_MAGIC.every((b, i) => bytes[i] === b)) {
    throw new Error('The selected file is not a valid .sqlite or .spz project database.');
  }

  const SQL = await getSqlJs();
  const db = new SQL.Database(bytes);
  migrateDatabaseSchema(db);
  const data = readDatabase(db);
  return makeSession(handle, db, data);
}

function makeSession(handle: FileSystemFileHandle, db: SqlDatabase, data: ProjectDatabase): DbSession {
  return {
    get fileName() {
      return handle.name;
    },

    get data() {
      return data;
    },

    updateCell(tableName, rowKey, columnName, value): void {
      const whereColumn = tableName.toLowerCase() === 'variables' ? 'variable' : 'id';
      db.run(
        `UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)} = ? WHERE ${quoteIdentifier(whereColumn)} = ?`,
        [toSqlValue(value), rowKey],
      );
      syncProjectDataCell(data, tableName, rowKey, columnName, value);
    },

    getTableNames(): string[] {
      return getDatabaseTableNames(db);
    },

    getTableSnapshot(tableName): DbTableSnapshot {
      return getTableSnapshot(db, tableName);
    },

    insertTimelineBar(input): DbBar {
      const bar: Omit<DbBar, 'id'> = {
        name: input.name ?? '',
        type: input.type ?? '',
        layer: input.layer,
        startTime: input.startTime,
        endTime: input.endTime,
        enabled: input.enabled ?? true,
        selected: input.selected ?? false,
        script: input.script ?? '',
        srcBlending: input.srcBlending ?? 'ONE',
        dstBlending: input.dstBlending ?? 'ZERO',
        blendingEQ: input.blendingEQ ?? '',
        srcAlpha: input.srcAlpha ?? '',
        dstAlpha: input.dstAlpha ?? '',
      };

      const columns = input.id !== undefined
        ? '"id", "name", "type", "layer", "startTime", "endTime", "enabled", "selected", "script", "srcBlending", "dstBlending", "blendingEQ", "srcAlpha", "dstAlpha"'
        : '"name", "type", "layer", "startTime", "endTime", "enabled", "selected", "script", "srcBlending", "dstBlending", "blendingEQ", "srcAlpha", "dstAlpha"';
      const placeholders = input.id !== undefined
        ? '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'
        : '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
      const values = [
        bar.name,
        bar.type,
        bar.layer,
        bar.startTime,
        bar.endTime,
        bar.enabled ? 1 : 0,
        bar.selected ? 1 : 0,
        bar.script,
        bar.srcBlending,
        bar.dstBlending,
        bar.blendingEQ,
        bar.srcAlpha,
        bar.dstAlpha,
      ];

      db.run(
        `INSERT INTO "BARS" (${columns}) VALUES (${placeholders})`,
        input.id !== undefined ? [input.id, ...values] : values,
      );

      const inserted: DbBar = {
        id: input.id ?? lastInsertRowId(db),
        ...bar,
      };
      data.bars.push(inserted);
      return inserted;
    },

    deleteTimelineBars(ids): DbBar[] {
      if (ids.length === 0) return [];
      const idSet = new Set(ids);
      const deleted = data.bars
        .filter((bar) => idSet.has(bar.id))
        .map((bar) => ({ ...bar }));
      if (deleted.length === 0) return [];

      const placeholders = deleted.map(() => '?').join(', ');
      db.run(`DELETE FROM "BARS" WHERE "id" IN (${placeholders})`, deleted.map((bar) => bar.id));
      removeWhere(data.bars, (bar) => idSet.has(bar.id));
      return deleted;
    },

    restoreTimelineBars(bars): DbBar[] {
      if (bars.length === 0) return [];
      const restored = bars.map((bar) => ({ ...bar }));
      const restoredIds = new Set(restored.map((bar) => bar.id));
      if (restoredIds.size !== restored.length) {
        throw new Error('Cannot undo bar deletion because the restoration payload contains duplicate ids.');
      }
      const conflicting = data.bars.find((bar) => restoredIds.has(bar.id));
      if (conflicting) {
        throw new Error(`Cannot undo bar deletion because bar ${conflicting.id} already exists.`);
      }

      db.run('BEGIN TRANSACTION');
      try {
        for (const bar of restored) {
          insertTimelineBarRow(db, bar);
        }
        db.run('COMMIT');
      } catch (error) {
        rollbackQuietly(db);
        throw error;
      }

      data.bars.push(...restored);
      return restored;
    },

    setTimelineBarEnabled(barId, enabled): DbBar {
      const bar = data.bars.find((candidate) => candidate.id === barId);
      if (!bar) {
        throw new Error(`Timeline bar ${barId} was not found.`);
      }

      db.run('UPDATE "BARS" SET "enabled" = ? WHERE "id" = ?', [enabled ? 1 : 0, barId]);
      bar.enabled = enabled;
      return bar;
    },

    insertTimelineMarker(input): DbMarker {
      validateMarkerTime(input.time);
      const label = input.label ?? '';
      if (input.id !== undefined) {
        db.run('INSERT INTO "MARKERS" ("id", "time", "label") VALUES (?, ?, ?)', [input.id, input.time, label]);
      } else {
        db.run('INSERT INTO "MARKERS" ("time", "label") VALUES (?, ?)', [input.time, label]);
      }

      const marker: DbMarker = {
        id: input.id ?? lastInsertRowId(db),
        time: input.time,
        label,
      };
      data.markers.push(marker);
      sortMarkers(data.markers);
      return marker;
    },

    updateTimelineMarker(markerId, input): DbMarker {
      const marker = data.markers.find((candidate) => candidate.id === markerId);
      if (!marker) {
        throw new Error(`Timeline marker ${markerId} was not found.`);
      }

      const nextTime = input.time ?? marker.time;
      const nextLabel = input.label ?? marker.label;
      validateMarkerTime(nextTime);
      db.run('UPDATE "MARKERS" SET "time" = ?, "label" = ? WHERE "id" = ?', [nextTime, nextLabel, markerId]);
      marker.time = nextTime;
      marker.label = nextLabel;
      sortMarkers(data.markers);
      return marker;
    },

    deleteTimelineMarker(markerId): DbMarker {
      const index = data.markers.findIndex((candidate) => candidate.id === markerId);
      if (index === -1) {
        throw new Error(`Timeline marker ${markerId} was not found.`);
      }

      const [marker] = data.markers.splice(index, 1);
      db.run('DELETE FROM "MARKERS" WHERE "id" = ?', [markerId]);
      return { ...marker };
    },

    restoreTimelineMarker(marker): DbMarker {
      const existing = data.markers.find((candidate) => candidate.id === marker.id);
      if (existing) {
        throw new Error(`Timeline marker ${marker.id} already exists.`);
      }
      return this.insertTimelineMarker(marker);
    },

    upsertResourceFile(input): DbFile {
      const existing = data.files.find((file) => file.parent === input.parent && file.name === input.name);
      const enabled = input.enabled ?? true;

      if (existing) {
        db.run(
          'UPDATE "FILES" SET "bytes" = ?, "type" = ?, "data" = ?, "format" = ?, "enabled" = ? WHERE "id" = ?',
          [input.bytes, input.type, input.data, input.format, enabled ? 1 : 0, existing.id],
        );
        Object.assign(existing, {
          bytes: input.bytes,
          type: input.type,
          data: input.data,
          format: input.format,
          enabled,
        });
        return existing;
      }

      db.run(
        'INSERT INTO "FILES" ("name", "parent", "bytes", "type", "data", "format", "enabled") VALUES (?, ?, ?, ?, ?, ?, ?)',
        [input.name, input.parent, input.bytes, input.type, input.data, input.format, enabled ? 1 : 0],
      );

      const file: DbFile = {
        id: lastInsertRowId(db),
        name: input.name,
        parent: input.parent,
        bytes: input.bytes,
        type: input.type,
        data: input.data,
        format: input.format,
        enabled,
      };
      data.files.push(file);
      return file;
    },

    insertResourceFolder(input): DbFolder {
      const existing = data.folders.find((folder) => folder.parent === input.parent && folder.name === input.name);
      if (existing) return existing;

      const enabled = input.enabled ?? true;
      db.run(
        'INSERT INTO "FOLDERS" ("name", "parent", "enabled") VALUES (?, ?, ?)',
        [input.name, input.parent, enabled ? 1 : 0],
      );

      const folder: DbFolder = {
        id: lastInsertRowId(db),
        name: input.name,
        parent: input.parent,
        enabled,
      };
      data.folders.push(folder);
      return folder;
    },

    createResourceFolder(parentId, name): DbFolder {
      validateDestination(data, parentId);
      const normalizedName = validateResourceItemName(data, parentId, name);
      db.run('INSERT INTO "FOLDERS" ("name", "parent", "enabled") VALUES (?, ?, ?)', [normalizedName, parentId, 1]);
      const folder: DbFolder = {
        id: lastInsertRowId(db),
        name: normalizedName,
        parent: parentId,
        enabled: true,
      };
      data.folders.push(folder);
      return folder;
    },

    findResourceScriptReferences(item): ResourceScriptReference[] {
      const target = getResourceItem(data, item);
      const oldPath = buildResourcePath(data, item.kind, target.id);
      return data.bars.flatMap((bar) => {
        const occurrences = countPoolPathReferences(bar.script, oldPath, item.kind === 'folder');
        return occurrences > 0 ? [{ barId: bar.id, occurrences }] : [];
      });
    },

    renameResourceItem(item, name, updateScriptPaths): ResourceRenameMutation {
      const target = getResourceItem(data, item);
      const normalizedName = validateResourceItemName(data, target.parent, name, item);
      const oldName = target.name;
      const oldPath = buildResourcePath(data, item.kind, target.id);
      if (normalizedName === oldName) {
        return { item, oldName, newName: oldName, oldPath, newPath: oldPath, files: [], scripts: [] };
      }

      const affectedIds = item.kind === 'file' ? [item.id] : collectRootFileIds(data, [item]);
      const oldPaths = new Map(affectedIds.map((id) => [id, buildResourcePath(data, 'file', id)]));
      const previousScripts = data.bars.map((bar) => bar.script);
      const scripts: ResourceScriptEdit[] = [];
      const table = item.kind === 'file' ? 'FILES' : 'FOLDERS';

      db.run('BEGIN TRANSACTION');
      try {
        db.run(`UPDATE "${table}" SET "name" = ? WHERE "id" = ?`, [normalizedName, item.id]);
        target.name = normalizedName;
        const newPath = buildResourcePath(data, item.kind, target.id);
        if (updateScriptPaths) {
          for (const bar of data.bars) {
            const after = rewritePoolPathReferences(bar.script, oldPath, newPath, item.kind === 'folder');
            if (after === bar.script) continue;
            scripts.push({ barId: bar.id, before: bar.script, after });
            db.run('UPDATE "BARS" SET "script" = ? WHERE "id" = ?', [after, bar.id]);
            bar.script = after;
          }
        }
        db.run('COMMIT');

        return {
          item,
          oldName,
          newName: normalizedName,
          oldPath,
          newPath,
          files: affectedIds.map((id) => {
            const file = data.files.find((candidate) => candidate.id === id);
            if (!file) throw new Error(`Pool file ${id} was not found after renaming.`);
            return { file, oldPath: oldPaths.get(id), newPath: buildResourcePath(data, 'file', id) };
          }),
          scripts,
        };
      } catch (error) {
        try { db.run('ROLLBACK'); } catch { /* Transaction may already be closed. */ }
        target.name = oldName;
        data.bars.forEach((bar, index) => { bar.script = previousScripts[index]; });
        throw error;
      }
    },

    restoreResourceRename(mutation): ResourceRenameMutation {
      const target = getResourceItem(data, mutation.item);
      if (target.name !== mutation.newName) {
        throw new Error(`Cannot undo rename because ${mutation.newName} was renamed again.`);
      }
      validateResourceItemName(data, target.parent, mutation.oldName, mutation.item);
      for (const edit of mutation.scripts) {
        const bar = data.bars.find((candidate) => candidate.id === edit.barId);
        if (!bar || bar.script !== edit.after) {
          throw new Error(`Cannot undo rename because script ${edit.barId} changed afterwards.`);
        }
      }
      const affectedIds = mutation.files.map((entry) => entry.file.id);
      const currentPaths = new Map(affectedIds.map((id) => [id, buildResourcePath(data, 'file', id)]));
      const table = mutation.item.kind === 'file' ? 'FILES' : 'FOLDERS';
      const previousScripts = data.bars.map((bar) => bar.script);

      db.run('BEGIN TRANSACTION');
      try {
        db.run(`UPDATE "${table}" SET "name" = ? WHERE "id" = ?`, [mutation.oldName, mutation.item.id]);
        target.name = mutation.oldName;
        for (const edit of mutation.scripts) {
          db.run('UPDATE "BARS" SET "script" = ? WHERE "id" = ?', [edit.before, edit.barId]);
          const bar = data.bars.find((candidate) => candidate.id === edit.barId);
          if (bar) bar.script = edit.before;
        }
        db.run('COMMIT');
      } catch (error) {
        try { db.run('ROLLBACK'); } catch { /* Transaction may already be closed. */ }
        target.name = mutation.newName;
        data.bars.forEach((bar, index) => { bar.script = previousScripts[index]; });
        throw error;
      }

      return {
        item: mutation.item,
        oldName: mutation.newName,
        newName: mutation.oldName,
        oldPath: mutation.newPath,
        newPath: mutation.oldPath,
        files: affectedIds.map((id) => {
          const file = data.files.find((candidate) => candidate.id === id);
          if (!file) throw new Error(`Pool file ${id} was not found after undoing rename.`);
          return { file, oldPath: currentPaths.get(id), newPath: buildResourcePath(data, 'file', id) };
        }),
        scripts: mutation.scripts.map((edit) => ({ barId: edit.barId, before: edit.after, after: edit.before })),
      };
    },

    moveResourceFile(fileId, parentId): DbFile {
      const file = data.files.find((candidate) => candidate.id === fileId);
      if (!file) {
        throw new Error(`Resource file ${fileId} was not found.`);
      }

      const existing = data.files.find((candidate) => (
        candidate.id !== fileId
        && candidate.parent === parentId
        && candidate.name === file.name
      ));
      if (existing) {
        throw new Error(`A file named ${file.name} already exists in the destination folder.`);
      }

      db.run('UPDATE "FILES" SET "parent" = ? WHERE "id" = ?', [parentId, fileId]);
      file.parent = parentId;
      return file;
    },

    copyResourceItems(roots, parentId): ResourceClipboardMutation {
      validateDestination(data, parentId);
      validateClipboardRootNames(data, roots, parentId);
      const previousFolders = data.folders.map((folder) => ({ ...folder }));
      const previousFiles = data.files.map(cloneDbFile);
      const createdRoots: ResourceItemRef[] = [];
      const createdFiles: DbFile[] = [];

      db.run('BEGIN TRANSACTION');
      try {
        for (const root of roots) {
          createdRoots.push(insertClipboardNode(db, data, root, parentId, createdFiles));
        }
        db.run('COMMIT');
      } catch (error) {
        rollbackResourceMutation(db, data, previousFolders, previousFiles);
        throw error;
      }

      return {
        operation: 'copy',
        roots: createdRoots,
        files: createdFiles.map((file) => ({
          file,
          newPath: buildResourcePath(data, 'file', file.id),
        })),
      };
    },

    moveResourceItems(roots, parentId): ResourceClipboardMutation {
      validateDestination(data, parentId);
      const canonicalRoots = canonicalizeResourceRefs(data, roots);
      validateMoveRoots(data, canonicalRoots, parentId);
      const previousFolders = data.folders.map((folder) => ({ ...folder }));
      const previousFiles = data.files.map(cloneDbFile);
      const affectedFileIds = collectRootFileIds(data, canonicalRoots);
      const oldPaths = new Map(affectedFileIds.map((id) => [id, buildResourcePath(data, 'file', id)]));

      db.run('BEGIN TRANSACTION');
      try {
        for (const root of canonicalRoots) {
          const table = root.kind === 'file' ? 'FILES' : 'FOLDERS';
          db.run(`UPDATE "${table}" SET "parent" = ? WHERE "id" = ?`, [parentId, root.id]);
          const item = root.kind === 'file'
            ? data.files.find((file) => file.id === root.id)
            : data.folders.find((folder) => folder.id === root.id);
          if (!item) throw new Error(`Pool ${root.kind} ${root.id} was not found.`);
          item.parent = parentId;
        }
        db.run('COMMIT');
      } catch (error) {
        rollbackResourceMutation(db, data, previousFolders, previousFiles);
        throw error;
      }

      return {
        operation: 'move',
        roots: canonicalRoots,
        files: affectedFileIds.map((id) => {
          const file = data.files.find((candidate) => candidate.id === id);
          if (!file) throw new Error(`Pool file ${id} was not found after moving.`);
          return {
            file,
            oldPath: oldPaths.get(id),
            newPath: buildResourcePath(data, 'file', id),
          };
        }),
      };
    },

    moveResourceItemsToParents(roots): ResourceClipboardMutation {
      const refs = canonicalizeResourceRefs(data, roots);
      const requested = new Map(roots.map((root) => [`${root.kind}:${root.id}`, root.parentId]));
      const previousFolders = data.folders.map((folder) => ({ ...folder }));
      const previousFiles = data.files.map(cloneDbFile);
      const affectedFileIds = collectRootFileIds(data, refs);
      const oldPaths = new Map(affectedFileIds.map((id) => [id, buildResourcePath(data, 'file', id)]));

      for (const root of refs) {
        const parentId = requested.get(`${root.kind}:${root.id}`);
        if (parentId === undefined) throw new Error('The original Pool destination is unavailable.');
        validateDestination(data, parentId);
        validateMoveRoots(data, [root], parentId);
      }

      db.run('BEGIN TRANSACTION');
      try {
        for (const root of refs) {
          const parentId = requested.get(`${root.kind}:${root.id}`);
          if (parentId === undefined) throw new Error('The original Pool destination is unavailable.');
          const table = root.kind === 'file' ? 'FILES' : 'FOLDERS';
          db.run(`UPDATE "${table}" SET "parent" = ? WHERE "id" = ?`, [parentId, root.id]);
          getResourceItem(data, root).parent = parentId;
        }
        db.run('COMMIT');
      } catch (error) {
        rollbackResourceMutation(db, data, previousFolders, previousFiles);
        throw error;
      }

      return {
        operation: 'move',
        roots: refs,
        files: affectedFileIds.map((id) => {
          const file = data.files.find((candidate) => candidate.id === id);
          if (!file) throw new Error(`Pool file ${id} was not found after moving.`);
          return { file, oldPath: oldPaths.get(id), newPath: buildResourcePath(data, 'file', id) };
        }),
      };
    },

    updateResourceFileContent(fileId, input): DbFile {
      const file = data.files.find((candidate) => candidate.id === fileId);
      if (!file) {
        throw new Error(`Resource file ${fileId} was not found.`);
      }

      db.run(
        'UPDATE "FILES" SET "bytes" = ?, "type" = ?, "data" = ?, "format" = ? WHERE "id" = ?',
        [input.bytes, input.type, input.data, input.format, fileId],
      );
      Object.assign(file, input);
      return file;
    },

    setResourceFileEnabled(fileId, enabled): DbFile {
      const file = data.files.find((candidate) => candidate.id === fileId);
      if (!file) {
        throw new Error(`Resource file ${fileId} was not found.`);
      }

      db.run('UPDATE "FILES" SET "enabled" = ? WHERE "id" = ?', [enabled ? 1 : 0, fileId]);
      file.enabled = enabled;
      return file;
    },

    deleteResourceFile(fileId): DbFile {
      const index = data.files.findIndex((candidate) => candidate.id === fileId);
      if (index === -1) {
        throw new Error(`Resource file ${fileId} was not found.`);
      }

      const file = data.files[index];
      db.run('DELETE FROM "FILES" WHERE "id" = ?', [fileId]);
      data.files.splice(index, 1);
      return file;
    },

    deleteResourceFolder(folderId): { folders: DbFolder[]; files: DbFile[] } {
      const deleted = this.deleteResourceItems([{ kind: 'folder', id: folderId }]);
      return {
        folders: deleted.folders.map((entry) => entry.row),
        files: deleted.files.map((entry) => entry.row),
      };
    },

    snapshotResourceItems(roots): ResourceDeletionSnapshot {
      return captureResourceItems(data, roots);
    },

    deleteResourceItems(roots, expected): ResourceDeletionSnapshot {
      const canonicalRoots = canonicalizeResourceRefs(data, roots);
      if (canonicalRoots.length === 0) throw new Error('Select at least one Pool item to delete.');
      const folderIds = collectRootFolderIds(data, canonicalRoots);
      const fileIds = new Set(collectRootFileIds(data, canonicalRoots));
      const snapshot = captureResourceItems(data, canonicalRoots);
      if (expected) validateExpectedDeletion(snapshot, expected);
      const previousFolders = data.folders.map((folder) => ({ ...folder }));
      const previousFiles = data.files.map(cloneDbFile);

      db.run('BEGIN TRANSACTION');
      try {
        deleteRowsByIds(db, 'FILES', [...fileIds]);
        deleteRowsByIds(db, 'FOLDERS', [...folderIds]);
        db.run('COMMIT');
        removeWhere(data.files, (file) => fileIds.has(file.id));
        removeWhere(data.folders, (folder) => folderIds.has(folder.id));
        return snapshot;
      } catch (error) {
        rollbackResourceMutation(db, data, previousFolders, previousFiles);
        throw error;
      }
    },

    restoreResourceItems(snapshot): ResourceClipboardMutation {
      validateResourceRestoration(data, snapshot);
      const previousFolders = data.folders.map((folder) => ({ ...folder }));
      const previousFiles = data.files.map(cloneDbFile);

      db.run('BEGIN TRANSACTION');
      try {
        for (const entry of sortRestoredFolders(snapshot.folders)) {
          const folder = entry.row;
          db.run('INSERT INTO "FOLDERS" ("id", "name", "parent", "enabled") VALUES (?, ?, ?, ?)', [
            folder.id, folder.name, folder.parent, folder.enabled ? 1 : 0,
          ]);
        }
        for (const entry of snapshot.files) {
          const file = entry.row;
          db.run(
            'INSERT INTO "FILES" ("id", "name", "parent", "bytes", "type", "data", "format", "enabled") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [file.id, file.name, file.parent, file.bytes, file.type, file.data, file.format, file.enabled ? 1 : 0],
          );
        }
        db.run('COMMIT');
        restoreRowsAtPositions(data.folders, snapshot.folders.map((entry) => ({ row: { ...entry.row }, index: entry.index })));
        restoreRowsAtPositions(data.files, snapshot.files.map((entry) => ({ row: cloneDbFile(entry.row), index: entry.index })));
      } catch (error) {
        rollbackResourceMutation(db, data, previousFolders, previousFiles);
        throw error;
      }

      return {
        operation: 'copy',
        roots: snapshot.roots.map((root) => ({ ...root })),
        files: snapshot.files.map((entry) => {
          const file = data.files.find((candidate) => candidate.id === entry.row.id);
          if (!file) throw new Error(`Restored Pool file ${entry.row.id} was not found.`);
          return { file, newPath: buildResourcePath(data, 'file', file.id) };
        }),
      };
    },

    updateGraphicsConfig(context, fbos): void {
      upsertVariable(db, data.variables, 'colorDepth', String(context.colorDepth));
      upsertVariable(db, data.variables, 'screenWidth', String(context.width));
      upsertVariable(db, data.variables, 'screenHeight', String(context.height));
      upsertVariable(db, data.variables, 'fullScreen', context.fullscreen ? '1' : '0');
      upsertVariable(db, data.variables, 'vsync', context.vsync ? '1' : '0');
      upsertVariable(db, data.variables, 'targetFps', context.targetFps === null ? '' : String(context.targetFps));

      for (const fbo of fbos) {
        const existing = data.fbos.find((candidate) => candidate.id === fbo.id);
        if (existing) {
          db.run(
            'UPDATE "FBOs" SET "ratio" = ?, "width" = ?, "height" = ?, "format" = ?, "colorAttachments" = ?, "filter" = ? WHERE "id" = ?',
            [fbo.ratio, fbo.width, fbo.height, fbo.format, fbo.colorAttachments, fbo.filter, fbo.id],
          );
          Object.assign(existing, fbo);
        } else {
          db.run(
            'INSERT INTO "FBOs" ("id", "ratio", "width", "height", "format", "colorAttachments", "filter") VALUES (?, ?, ?, ?, ?, ?, ?)',
            [fbo.id, fbo.ratio, fbo.width, fbo.height, fbo.format, fbo.colorAttachments, fbo.filter],
          );
          data.fbos.push({ ...fbo });
        }
      }
      data.fbos.sort((a, b) => a.id - b.id);
    },

    updateDemoSettings(settings): void {
      upsertVariable(db, data.variables, 'demoName', settings.demoName);
      upsertVariable(db, data.variables, 'demoLoop', settings.loop ? '1' : '0');
      upsertVariable(db, data.variables, 'demoSound', settings.sound ? '1' : '0');
      upsertVariable(db, data.variables, 'debugEnableGrid', settings.debugGrid ? '1' : '0');
      upsertVariable(db, data.variables, 'logDetail', String(settings.logDetail));
    },

    async save(): Promise<void> {
      // .slice() copies the WASM-backed buffer into a plain ArrayBuffer
      const blob = new Blob([serializeDatabase(db).slice()]);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    },

    async saveAs(newHandle: FileSystemFileHandle): Promise<DbSession> {
      const blob = new Blob([serializeDatabase(db).slice()]);
      const writable = await newHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return makeSession(newHandle, db, data);
    },

    close(): void {
      db.close();
    },
  };
}

export function validateResourceItemName(
  data: Pick<ProjectDatabase, 'files' | 'folders'>,
  parentId: number,
  name: string,
  excluded?: ResourceItemRef,
): string {
  const normalized = name.trim();
  if (!normalized) throw new Error('Name cannot be empty.');
  if (normalized === '.' || normalized === '..') throw new Error('Name cannot be . or ...');
  if (/[\\/]/.test(normalized)) throw new Error('Name cannot contain path separators.');
  if ([...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) throw new Error('Name cannot contain control characters.');
  const key = normalized.toLocaleLowerCase();
  const conflict = [
    ...data.files.map((row) => ({ kind: 'file' as const, ...row })),
    ...data.folders.map((row) => ({ kind: 'folder' as const, ...row })),
  ].some((row) => (
    row.parent === parentId
    && row.name.toLocaleLowerCase() === key
    && (!excluded || row.kind !== excluded.kind || row.id !== excluded.id)
  ));
  if (conflict) throw new Error(`An item named ${normalized} already exists in this folder.`);
  return normalized;
}

function validateDestination(data: ProjectDatabase, parentId: number): void {
  if (!Number.isInteger(parentId) || parentId < 0) throw new Error('Pool destination is invalid.');
  if (parentId > 0 && !data.folders.some((folder) => folder.id === parentId)) {
    throw new Error('The selected Pool destination no longer exists.');
  }
}

function getResourceItem(data: ProjectDatabase, item: ResourceItemRef): DbFile | DbFolder {
  const row = item.kind === 'file'
    ? data.files.find((candidate) => candidate.id === item.id)
    : data.folders.find((candidate) => candidate.id === item.id);
  if (!row) throw new Error(`Pool ${item.kind} ${item.id} is no longer available.`);
  return row;
}

function countPoolPathReferences(script: string, path: string, folder: boolean): number {
  return [...script.matchAll(poolPathPattern(path, folder))].length;
}

function rewritePoolPathReferences(script: string, oldPath: string, newPath: string, folder: boolean): string {
  return script.replace(poolPathPattern(oldPath, folder), newPath);
}

function poolPathPattern(path: string, folder: boolean): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = folder ? '(?=\\/|[^A-Za-z0-9_.-]|$)' : '(?![A-Za-z0-9_.\\/\\-])';
  return new RegExp(`${escaped}${boundary}`, 'g');
}

function validateClipboardRootNames(data: ProjectDatabase, roots: AssetClipboardNode[], parentId: number): void {
  if (roots.length === 0) throw new Error('The Pool clipboard is empty.');
  const incoming = new Set<string>();
  for (const root of roots) {
    const key = root.name.toLocaleLowerCase();
    if (incoming.has(key)) throw new Error(`The clipboard contains more than one item named ${root.name}.`);
    incoming.add(key);
  }
  const siblings = [
    ...data.files.filter((file) => file.parent === parentId),
    ...data.folders.filter((folder) => folder.parent === parentId),
  ];
  for (const root of roots) {
    if (siblings.some((item) => item.name.localeCompare(root.name, undefined, { sensitivity: 'accent' }) === 0)) {
      throw new Error(`An item named ${root.name} already exists in the destination folder.`);
    }
  }
}

function insertClipboardNode(
  db: SqlDatabase,
  data: ProjectDatabase,
  node: AssetClipboardNode,
  parentId: number,
  createdFiles: DbFile[],
): ResourceItemRef {
  if (node.kind === 'file') {
    db.run(
      'INSERT INTO "FILES" ("name", "parent", "bytes", "type", "data", "format", "enabled") VALUES (?, ?, ?, ?, ?, ?, ?)',
      [node.name, parentId, node.bytes, node.type, node.data, node.format, node.enabled ? 1 : 0],
    );
    const file: DbFile = {
      id: lastInsertRowId(db),
      name: node.name,
      parent: parentId,
      bytes: node.bytes,
      type: node.type,
      data: new Uint8Array(node.data),
      format: node.format,
      enabled: node.enabled,
    };
    data.files.push(file);
    createdFiles.push(file);
    return { kind: 'file', id: file.id };
  }

  db.run(
    'INSERT INTO "FOLDERS" ("name", "parent", "enabled") VALUES (?, ?, ?)',
    [node.name, parentId, node.enabled ? 1 : 0],
  );
  const folder: DbFolder = {
    id: lastInsertRowId(db),
    name: node.name,
    parent: parentId,
    enabled: node.enabled,
  };
  data.folders.push(folder);
  for (const child of node.children) insertClipboardNode(db, data, child, folder.id, createdFiles);
  return { kind: 'folder', id: folder.id };
}

function canonicalizeResourceRefs(data: ProjectDatabase, roots: ResourceItemRef[]): ResourceItemRef[] {
  const unique = new Map(roots.map((root) => [`${root.kind}:${root.id}`, root]));
  const selectedFolders = new Set(
    [...unique.values()].filter((root) => root.kind === 'folder').map((root) => root.id),
  );
  return [...unique.values()].filter((root) => {
    const item = root.kind === 'file'
      ? data.files.find((file) => file.id === root.id)
      : data.folders.find((folder) => folder.id === root.id);
    if (!item) throw new Error(`Pool ${root.kind} ${root.id} is no longer available.`);
    let parentId = item.parent;
    while (parentId > 0) {
      if (selectedFolders.has(parentId)) return false;
      parentId = data.folders.find((folder) => folder.id === parentId)?.parent ?? 0;
    }
    return true;
  });
}

function validateMoveRoots(data: ProjectDatabase, roots: ResourceItemRef[], parentId: number): void {
  if (roots.length === 0) throw new Error('The Pool clipboard is empty.');
  const movingKeys = new Set(roots.map((root) => `${root.kind}:${root.id}`));
  const names = new Set<string>();

  for (const root of roots) {
    const item = root.kind === 'file'
      ? data.files.find((file) => file.id === root.id)
      : data.folders.find((folder) => folder.id === root.id);
    if (!item) throw new Error(`Pool ${root.kind} ${root.id} is no longer available.`);
    if (item.parent === parentId) throw new Error(`${item.name} is already in the destination folder.`);
    const nameKey = item.name.toLocaleLowerCase();
    if (names.has(nameKey)) throw new Error(`More than one selected item is named ${item.name}.`);
    names.add(nameKey);

    if (root.kind === 'folder') {
      let ancestorId = parentId;
      while (ancestorId > 0) {
        if (ancestorId === root.id) throw new Error(`Folder ${item.name} cannot be moved into itself or a descendant.`);
        ancestorId = data.folders.find((folder) => folder.id === ancestorId)?.parent ?? 0;
      }
    }

    const conflict = [
      ...data.files.filter((file) => file.parent === parentId).map((file) => ({ kind: 'file' as const, ...file })),
      ...data.folders.filter((folder) => folder.parent === parentId).map((folder) => ({ kind: 'folder' as const, ...folder })),
    ].find((candidate) => (
      !movingKeys.has(`${candidate.kind}:${candidate.id}`)
      && candidate.name.localeCompare(item.name, undefined, { sensitivity: 'accent' }) === 0
    ));
    if (conflict) throw new Error(`An item named ${item.name} already exists in the destination folder.`);
  }
}

function collectRootFileIds(data: ProjectDatabase, roots: ResourceItemRef[]): number[] {
  const folderIds = new Set(roots.filter((root) => root.kind === 'folder').map((root) => root.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of data.folders) {
      if (!folderIds.has(folder.id) && folderIds.has(folder.parent)) {
        folderIds.add(folder.id);
        changed = true;
      }
    }
  }
  const ids = roots.filter((root) => root.kind === 'file').map((root) => root.id);
  for (const file of data.files) if (folderIds.has(file.parent)) ids.push(file.id);
  return [...new Set(ids)];
}

function collectRootFolderIds(data: ProjectDatabase, roots: ResourceItemRef[]): Set<number> {
  const folderIds = new Set(roots.filter((root) => root.kind === 'folder').map((root) => root.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of data.folders) {
      if (!folderIds.has(folder.id) && folderIds.has(folder.parent)) {
        folderIds.add(folder.id);
        changed = true;
      }
    }
  }
  return folderIds;
}

function captureResourceItems(data: ProjectDatabase, roots: ResourceItemRef[]): ResourceDeletionSnapshot {
  const canonicalRoots = canonicalizeResourceRefs(data, roots);
  if (canonicalRoots.length === 0) throw new Error('Select at least one Pool item.');
  const folderIds = collectRootFolderIds(data, canonicalRoots);
  const fileIds = new Set(collectRootFileIds(data, canonicalRoots));
  return {
    roots: canonicalRoots.map((root) => ({ ...root })),
    folders: data.folders.flatMap((folder, index) => folderIds.has(folder.id)
      ? [{ row: { ...folder }, index }]
      : []),
    files: data.files.flatMap((file, index) => fileIds.has(file.id)
      ? [{ row: cloneDbFile(file), index, path: buildResourcePath(data, 'file', file.id) }]
      : []),
  };
}

function validateExpectedDeletion(current: ResourceDeletionSnapshot, expected: ResourceDeletionSnapshot): void {
  const currentKeys = [
    ...current.folders.map((entry) => `folder:${entry.row.id}`),
    ...current.files.map((entry) => `file:${entry.row.id}`),
  ].sort();
  const expectedKeys = [
    ...expected.folders.map((entry) => `folder:${entry.row.id}`),
    ...expected.files.map((entry) => `file:${entry.row.id}`),
  ].sort();
  if (currentKeys.length !== expectedKeys.length || currentKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('Cannot undo Paste because the pasted subtree changed afterwards.');
  }
}

function deleteRowsByIds(db: SqlDatabase, table: 'FILES' | 'FOLDERS', ids: number[]): void {
  if (ids.length === 0) return;
  db.run(`DELETE FROM "${table}" WHERE "id" IN (${ids.map(() => '?').join(', ')})`, ids);
}

function validateResourceRestoration(data: ProjectDatabase, snapshot: ResourceDeletionSnapshot): void {
  const folderIds = new Set(snapshot.folders.map((entry) => entry.row.id));
  const fileIds = new Set(snapshot.files.map((entry) => entry.row.id));
  if (data.folders.some((folder) => folderIds.has(folder.id)) || data.files.some((file) => fileIds.has(file.id))) {
    throw new Error('Cannot undo because one of the original Pool ids is already in use.');
  }
  for (const root of snapshot.roots) {
    const row = root.kind === 'file'
      ? snapshot.files.find((entry) => entry.row.id === root.id)?.row
      : snapshot.folders.find((entry) => entry.row.id === root.id)?.row;
    if (!row) throw new Error(`Cannot undo because Pool ${root.kind} ${root.id} is missing from the restoration payload.`);
    if (row.parent > 0 && !folderIds.has(row.parent) && !data.folders.some((folder) => folder.id === row.parent)) {
      throw new Error(`Cannot undo ${row.name} because its original parent no longer exists.`);
    }
    validateResourceItemName(data, row.parent, row.name);
  }
}

function sortRestoredFolders(entries: ResourceDeletionSnapshot['folders']): ResourceDeletionSnapshot['folders'] {
  const pending = [...entries];
  const restored = new Set<number>();
  const result: ResourceDeletionSnapshot['folders'] = [];
  while (pending.length > 0) {
    const index = pending.findIndex((entry) => entry.row.parent === 0
      || restored.has(entry.row.parent)
      || !pending.some((candidate) => candidate.row.id === entry.row.parent));
    if (index < 0) throw new Error('Cannot restore a Pool folder hierarchy containing a cycle.');
    const [entry] = pending.splice(index, 1);
    result.push(entry);
    restored.add(entry.row.id);
  }
  return result;
}

function restoreRowsAtPositions<T>(target: T[], entries: Array<{ row: T; index: number }>): void {
  for (const entry of [...entries].sort((left, right) => left.index - right.index)) {
    target.splice(Math.min(entry.index, target.length), 0, entry.row);
  }
}

function rollbackResourceMutation(
  db: SqlDatabase,
  data: ProjectDatabase,
  folders: DbFolder[],
  files: DbFile[],
): void {
  try {
    db.run('ROLLBACK');
  } catch {
    // The database may already have rejected and closed the transaction.
  }
  data.folders.splice(0, data.folders.length, ...folders);
  data.files.splice(0, data.files.length, ...files);
}

function cloneDbFile(file: DbFile): DbFile {
  return { ...file, data: new Uint8Array(file.data) };
}

function insertTimelineBarRow(db: SqlDatabase, bar: DbBar): void {
  db.run(
    'INSERT INTO "BARS" ("id", "name", "type", "layer", "startTime", "endTime", "enabled", "selected", "script", "srcBlending", "dstBlending", "blendingEQ", "srcAlpha", "dstAlpha") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      bar.id,
      bar.name,
      bar.type,
      bar.layer,
      bar.startTime,
      bar.endTime,
      bar.enabled ? 1 : 0,
      bar.selected ? 1 : 0,
      bar.script,
      bar.srcBlending,
      bar.dstBlending,
      bar.blendingEQ,
      bar.srcAlpha,
      bar.dstAlpha,
    ],
  );
}

function rollbackQuietly(db: SqlDatabase): void {
  try {
    db.run('ROLLBACK');
  } catch {
    // The database may already have rejected and closed the transaction.
  }
}

function migrateDatabaseSchema(db: SqlDatabase): void {
  const columns = getTableColumnNames(db, 'BARS');
  if (columns.length > 0 && !columns.some((column) => column.toLowerCase() === 'name')) {
    db.run('ALTER TABLE "BARS" ADD COLUMN "name" TEXT DEFAULT ""');
    db.run('UPDATE "BARS" SET "name" = COALESCE("type", "") WHERE "name" IS NULL OR "name" = ""');
  }

  migrateMarkersTableName(db);
}

function migrateMarkersTableName(db: SqlDatabase): void {
  const existingName = getDatabaseTableNames(db).find((name) => name.toLowerCase() === 'markers');
  if (!existingName) {
    createMarkersTable(db);
    return;
  }

  if (existingName === 'MARKERS') {
    return;
  }

  const temporaryName = '__cacablu_markers_migration';
  db.run(`ALTER TABLE ${quoteIdentifier(existingName)} RENAME TO ${quoteIdentifier(temporaryName)}`);
  createMarkersTable(db);
  db.run(
    `INSERT INTO "MARKERS" ("id", "time", "label") SELECT "id", "time", "label" FROM ${quoteIdentifier(temporaryName)}`,
  );
  db.run(`DROP TABLE ${quoteIdentifier(temporaryName)}`);
}

function createMarkersTable(db: SqlDatabase): void {
  db.run('CREATE TABLE IF NOT EXISTS "MARKERS" ("id" INTEGER PRIMARY KEY, "time" REAL NOT NULL, "label" TEXT NOT NULL DEFAULT "")');
}

function getTableColumnNames(db: SqlDatabase, tableName: string): string[] {
  try {
    return (db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)})`)[0]?.values ?? [])
      .map((row) => row[1])
      .filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function getDatabaseTableNames(db: SqlDatabase): string[] {
  return (db.exec(
    'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\' ORDER BY name COLLATE NOCASE',
  )[0]?.values ?? [])
    .map((row) => row[0])
    .filter((value): value is string => typeof value === 'string');
}

function getTableSnapshot(db: SqlDatabase, tableName: string): DbTableSnapshot {
  const columns = getTableColumnNames(db, tableName);
  const result = db.exec(`SELECT * FROM ${quoteIdentifier(tableName)}`)[0];
  const resultColumns = result?.columns ?? columns;
  const rows = (result?.values ?? []).map((values) => {
    const row: Record<string, DbTableCellValue> = {};
    resultColumns.forEach((column, index) => {
      const value = values[index];
      row[column] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    });
    return row;
  });
  return {
    name: tableName,
    columns: resultColumns,
    rows,
  };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function toSqlValue(value: EditableDbValue): string | number | null {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function lastInsertRowId(db: SqlDatabase): number {
  const value = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : 0;
}

function validateMarkerTime(time: number): void {
  if (!Number.isFinite(time)) {
    throw new Error('Timeline marker time must be finite.');
  }
}

function sortMarkers(markers: DbMarker[]): void {
  markers.sort((left, right) => left.time - right.time || left.id - right.id);
}

function syncProjectDataCell(
  data: ProjectDatabase,
  tableName: string,
  rowKey: string | number,
  columnName: string,
  value: EditableDbValue,
): void {
  const normalizedTableName = tableName.toLowerCase();
  if (normalizedTableName === 'variables') {
    data.variables.set(String(rowKey), String(value ?? ''));
    return;
  }

  const rows = getKnownProjectRows(data, normalizedTableName);
  if (!rows) return;

  const row = rows.find((candidate) => candidate.id === rowKey);
  if (!row) return;
  row[columnName] = value;
}

function getKnownProjectRows(data: ProjectDatabase, normalizedTableName: string): Array<Record<string, unknown> & { id: number }> | null {
  switch (normalizedTableName) {
    case 'bars':
      return data.bars as unknown as Array<Record<string, unknown> & { id: number }>;
    case 'fbos':
      return data.fbos as unknown as Array<Record<string, unknown> & { id: number }>;
    case 'files':
      return data.files as unknown as Array<Record<string, unknown> & { id: number }>;
    case 'folders':
      return data.folders as unknown as Array<Record<string, unknown> & { id: number }>;
    case 'markers':
      return data.markers as unknown as Array<Record<string, unknown> & { id: number }>;
    default:
      return null;
  }
}

function upsertVariable(db: SqlDatabase, variables: Map<string, string>, key: string, value: string): void {
  if (variables.has(key)) {
    db.run('UPDATE "variables" SET "value" = ? WHERE "variable" = ?', [value, key]);
  } else {
    db.run('INSERT INTO "variables" ("variable", "value") VALUES (?, ?)', [key, value]);
  }
  variables.set(key, value);
}

function removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) items.splice(index, 1);
  }
}
