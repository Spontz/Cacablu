import type { SqlDatabase } from './sql-loader';
import type { DbBar, DbFbo, DbFile, DbFolder, DbMarker, ProjectDatabase } from './db-schema';

type Row = (number | string | Uint8Array | null)[];
type VariableColumnPair = {
  keyColumn: string;
  valueColumn: string;
};

function queryRows(db: SqlDatabase, sql: string): Row[] {
  try {
    return db.exec(sql)[0]?.values ?? [];
  } catch {
    return [];
  }
}

export function readDatabase(db: SqlDatabase): ProjectDatabase {
  const variables = new Map<string, string>();
  readVariableRows(db).forEach(([key, value]) => variables.set(key, value));

  const bars: DbBar[] = queryRows(
    db,
    'SELECT id, name, type, layer, startTime, endTime, enabled, selected, script, srcBlending, dstBlending, blendingEQ, srcAlpha, dstAlpha FROM BARS',
  ).map((r) => ({
    id: r[0] as number,
    name: (r[1] as string) ?? '',
    type: (r[2] as string) ?? '',
    layer: r[3] as number,
    startTime: r[4] as number,
    endTime: r[5] as number,
    enabled: Boolean(r[6]),
    selected: Boolean(r[7]),
    script: toText(r[8]),
    srcBlending: (r[9] as string) ?? '',
    dstBlending: (r[10] as string) ?? '',
    blendingEQ: (r[11] as string) ?? '',
    srcAlpha: (r[12] as string) ?? '',
    dstAlpha: (r[13] as string) ?? '',
  }));

  const fbos: DbFbo[] = queryRows(
    db,
    'SELECT id, ratio, width, height, format, colorAttachments, filter FROM FBOs',
  ).map((r) => ({
    id: r[0] as number,
    ratio: r[1] as number,
    width: r[2] as number,
    height: r[3] as number,
    format: (r[4] as string) ?? '',
    colorAttachments: r[5] as number,
    filter: (r[6] as string) ?? 'Bilinear',
  }));

  const files: DbFile[] = queryRows(
    db,
    'SELECT id, name, parent, bytes, type, data, format, enabled FROM FILES',
  ).map((r) => ({
    id: r[0] as number,
    name: (r[1] as string) ?? '',
    parent: r[2] as number,
    bytes: r[3] as number,
    type: (r[4] as string) ?? '',
    data: (r[5] as Uint8Array) ?? new Uint8Array(),
    format: (r[6] as string) ?? '',
    enabled: Boolean(r[7]),
  }));

  const folders: DbFolder[] = queryRows(
    db,
    'SELECT id, name, parent, enabled FROM FOLDERS',
  ).map((r) => ({
    id: r[0] as number,
    name: (r[1] as string) ?? '',
    parent: r[2] as number,
    enabled: Boolean(r[3]),
  }));

  const markers: DbMarker[] = queryRows(
    db,
    'SELECT id, time, label FROM MARKERS ORDER BY time, id',
  ).map((r) => ({
    id: r[0] as number,
    time: r[1] as number,
    label: toText(r[2]),
  }));

  return { variables, bars, fbos, files, folders, markers };
}

function readVariableRows(db: SqlDatabase): Array<[string, string]> {
  const rows: Array<[string, string]> = [];

  for (const columns of discoverVariableColumns(db)) {
    const query = `SELECT ${quoteIdentifier(columns.keyColumn)}, ${quoteIdentifier(columns.valueColumn)} FROM "variables"`;

    for (const row of queryRows(db, query)) {
      rows.push([toText(row[0]), toText(row[1])]);
    }
  }

  return rows.filter(([key]) => key.length > 0);
}

function discoverVariableColumns(db: SqlDatabase): VariableColumnPair[] {
  const tableInfo = queryRows(db, 'PRAGMA table_info("variables")');
  const columnNames = tableInfo
    .map((row) => toText(row[1]))
    .filter((columnName) => columnName.length > 0);

  const keyColumn = findColumn(columnNames, ['variable', 'name', 'key', 'var', 'id']);
  const valueColumn = findColumn(columnNames, ['value', 'val', 'data']);

  if (keyColumn && valueColumn) {
    return [{ keyColumn, valueColumn }];
  }

  return [
    { keyColumn: 'variable', valueColumn: 'value' },
    { keyColumn: 'id', valueColumn: 'value' },
    { keyColumn: 'name', valueColumn: 'value' },
  ];
}

function findColumn(columnNames: string[], candidates: string[]): string | undefined {
  return candidates
    .map((candidate) => columnNames.find((columnName) => columnName.toLowerCase() === candidate.toLowerCase()))
    .find((columnName): columnName is string => Boolean(columnName));
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function toText(value: number | string | Uint8Array | null): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return new TextDecoder().decode(value);
}
