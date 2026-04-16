import type { SqlDatabase } from './sql-loader';
import type { DbBar, DbFbo, DbFile, DbFolder, ProjectDatabase } from './db-schema';

type Row = (number | string | Uint8Array | null)[];

function queryRows(db: SqlDatabase, sql: string): Row[] {
  try {
    return db.exec(sql)[0]?.values ?? [];
  } catch {
    return [];
  }
}

export function readDatabase(db: SqlDatabase): ProjectDatabase {
  const variables = new Map<string, string>();
  for (const row of queryRows(db, 'SELECT variable, value FROM VARIABLES')) {
    variables.set(row[0] as string, (row[1] as string) ?? '');
  }

  const bars: DbBar[] = queryRows(
    db,
    'SELECT id, type, layer, startTime, endTime, enabled, selected, script, srcBlending, dstBlending, blendingEQ, srcAlpha, dstAlpha FROM BARS',
  ).map((r) => ({
    id: r[0] as number,
    type: (r[1] as string) ?? '',
    layer: r[2] as number,
    startTime: r[3] as number,
    endTime: r[4] as number,
    enabled: Boolean(r[5]),
    selected: Boolean(r[6]),
    script: (r[7] as string) ?? '',
    srcBlending: (r[8] as string) ?? '',
    dstBlending: (r[9] as string) ?? '',
    blendingEQ: (r[10] as string) ?? '',
    srcAlpha: (r[11] as string) ?? '',
    dstAlpha: (r[12] as string) ?? '',
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

  return { variables, bars, fbos, files, folders };
}
