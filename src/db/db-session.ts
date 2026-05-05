import { getSqlJs } from './sql-loader';
import type { SqlDatabase } from './sql-loader';
import { readDatabase } from './db-reader';
import { serializeDatabase } from './db-writer';
import type { ProjectDatabase } from './db-schema';

// First 16 bytes of any valid SQLite file: "SQLite format 3\0"
const SQLITE_MAGIC = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]);

export interface DbSession {
  readonly fileName: string;
  readonly data: ProjectDatabase;
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
