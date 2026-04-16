import initSqlJs from 'sql.js';
// ?inline embeds the WASM as a base64 data URL so fetch() works from file://
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?inline';

export type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;
export type SqlDatabase = InstanceType<SqlJsStatic['Database']>;

let pending: Promise<SqlJsStatic> | null = null;

export function getSqlJs(): Promise<SqlJsStatic> {
  pending ??= initSqlJs({ locateFile: () => wasmUrl });
  return pending;
}
