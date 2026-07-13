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
  setTimelineBarEnabled(barId: number, enabled: boolean): DbBar;
  insertTimelineMarker(input: NewTimelineMarker): DbMarker;
  updateTimelineMarker(markerId: number, input: Partial<Pick<DbMarker, 'time' | 'label'>>): DbMarker;
  deleteTimelineMarker(markerId: number): DbMarker;
  restoreTimelineMarker(marker: DbMarker): DbMarker;
  upsertResourceFile(input: NewResourceFile): DbFile;
  insertResourceFolder(input: NewResourceFolder): DbFolder;
  moveResourceFile(fileId: number, parentId: number): DbFile;
  copyResourceItems(roots: AssetClipboardNode[], parentId: number): ResourceClipboardMutation;
  moveResourceItems(roots: ResourceItemRef[], parentId: number): ResourceClipboardMutation;
  updateResourceFileContent(fileId: number, input: Pick<DbFile, 'bytes' | 'type' | 'data' | 'format'>): DbFile;
  setResourceFileEnabled(fileId: number, enabled: boolean): DbFile;
  deleteResourceFile(fileId: number): DbFile;
  deleteResourceFolder(folderId: number): { folders: DbFolder[]; files: DbFile[] };
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
      const target = data.folders.find((candidate) => candidate.id === folderId);
      if (!target) {
        throw new Error(`Resource folder ${folderId} was not found.`);
      }

      const folderIds = new Set<number>([folderId]);
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

      const deletedFolders = data.folders.filter((folder) => folderIds.has(folder.id));
      const deletedFiles = data.files.filter((file) => folderIds.has(file.parent));
      const placeholders = [...folderIds].map(() => '?').join(', ');
      db.run(`DELETE FROM "FILES" WHERE "parent" IN (${placeholders})`, [...folderIds]);
      db.run(`DELETE FROM "FOLDERS" WHERE "id" IN (${placeholders})`, [...folderIds]);
      removeWhere(data.files, (file) => folderIds.has(file.parent));
      removeWhere(data.folders, (folder) => folderIds.has(folder.id));
      return { folders: deletedFolders, files: deletedFiles };
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

function validateDestination(data: ProjectDatabase, parentId: number): void {
  if (!Number.isInteger(parentId) || parentId < 0) throw new Error('Pool destination is invalid.');
  if (parentId > 0 && !data.folders.some((folder) => folder.id === parentId)) {
    throw new Error('The selected Pool destination no longer exists.');
  }
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
