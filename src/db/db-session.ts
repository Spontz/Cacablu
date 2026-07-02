import { getSqlJs } from './sql-loader';
import type { SqlDatabase } from './sql-loader';
import { readDatabase } from './db-reader';
import { serializeDatabase } from './db-writer';
import type { DbFile, DbFolder, ProjectDatabase } from './db-schema';

type EditableDbValue = string | number | boolean | null;
type DbTableName = 'variables' | 'bars' | 'fbos' | 'files' | 'folders';
type NewResourceFile = Pick<DbFile, 'name' | 'parent' | 'bytes' | 'type' | 'data' | 'format'> & Partial<Pick<DbFile, 'enabled'>>;
type NewResourceFolder = Pick<DbFolder, 'name' | 'parent'> & Partial<Pick<DbFolder, 'enabled'>>;

// First 16 bytes of any valid SQLite file: "SQLite format 3\0"
const SQLITE_MAGIC = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]);

export interface DbSession {
  readonly fileName: string;
  readonly data: ProjectDatabase;
  updateCell(tableName: DbTableName, rowKey: string | number, columnName: string, value: EditableDbValue): void;
  upsertResourceFile(input: NewResourceFile): DbFile;
  insertResourceFolder(input: NewResourceFolder): DbFolder;
  moveResourceFile(fileId: number, parentId: number): DbFile;
  setResourceFileEnabled(fileId: number, enabled: boolean): DbFile;
  deleteResourceFile(fileId: number): DbFile;
  deleteResourceFolder(folderId: number): { folders: DbFolder[]; files: DbFile[] };
  save(): Promise<void>;
  saveAs(handle: FileSystemFileHandle): Promise<DbSession>;
  close(): void;
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
      const whereColumn = tableName === 'variables' ? 'variable' : 'id';
      db.run(
        `UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)} = ? WHERE ${quoteIdentifier(whereColumn)} = ?`,
        [toSqlValue(value), rowKey],
      );
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

function removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) items.splice(index, 1);
  }
}
