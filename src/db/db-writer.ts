import type { SqlDatabase } from './sql-loader';

export function serializeDatabase(db: SqlDatabase): Uint8Array {
  return db.export();
}
