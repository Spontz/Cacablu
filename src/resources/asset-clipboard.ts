import type { DbFile, DbFolder, ProjectDatabase } from '../db/db-schema';
import type { AssetSelectionItem } from '../app/types';
import type { AssetSelection } from '../app/types';
import { assetSelectionKey } from './asset-selection';
import { getAssetSelectionItems } from './asset-selection';

export type AssetClipboardOperation = 'copy' | 'cut';

export interface AssetClipboardFile {
  kind: 'file';
  sourceId: number;
  name: string;
  path: string;
  bytes: number;
  type: string;
  data: Uint8Array;
  format: string;
  enabled: boolean;
}

export interface AssetClipboardFolder {
  kind: 'folder';
  sourceId: number;
  name: string;
  path: string;
  enabled: boolean;
  children: AssetClipboardNode[];
}

export type AssetClipboardNode = AssetClipboardFile | AssetClipboardFolder;

export interface AssetClipboardSnapshot {
  operation: AssetClipboardOperation;
  sourceSession: object;
  roots: AssetClipboardNode[];
  text: string;
}

type Listener = (snapshot: AssetClipboardSnapshot | null) => void;

export interface AssetClipboard {
  getSnapshot(): AssetClipboardSnapshot | null;
  subscribe(listener: Listener): () => void;
  capture(operation: AssetClipboardOperation, sourceSession: object, db: ProjectDatabase, selection: AssetSelectionItem[]): AssetClipboardSnapshot;
  clear(): void;
  consumeCut(): void;
  invalidateSession(activeSession: object | null): void;
  revalidateText(text: string): boolean;
}

export function createAssetClipboard(): AssetClipboard {
  let snapshot: AssetClipboardSnapshot | null = null;
  const listeners = new Set<Listener>();

  function publish(): void {
    for (const listener of listeners) listener(snapshot);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener): () => void {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
    capture(operation, sourceSession, db, selection): AssetClipboardSnapshot {
      const roots = captureAssetRoots(db, selection);
      if (roots.length === 0) throw new Error('Select at least one Pool item to copy or cut.');
      snapshot = {
        operation,
        sourceSession,
        roots,
        text: serializePoolPaths(roots.map((root) => root.path)),
      };
      publish();
      return snapshot;
    },
    clear(): void {
      if (!snapshot) return;
      snapshot = null;
      publish();
    },
    consumeCut(): void {
      if (snapshot?.operation !== 'cut') return;
      snapshot = null;
      publish();
    },
    invalidateSession(activeSession): void {
      if (snapshot?.operation !== 'cut' || snapshot.sourceSession === activeSession) return;
      snapshot = null;
      publish();
    },
    revalidateText(text): boolean {
      if (!snapshot || normalizeClipboardText(text) === normalizeClipboardText(snapshot.text)) return true;
      snapshot = null;
      publish();
      return false;
    },
  };
}

export function captureAssetRoots(db: ProjectDatabase, selection: AssetSelectionItem[]): AssetClipboardNode[] {
  const ordered = canonicalizeSelection(db, selection);
  const foldersByParent = groupByParent(db.folders);
  const filesByParent = groupByParent(db.files);
  return ordered.map((item) => item.kind === 'file'
    ? captureFile(requireFile(db, item.id), buildResourcePath(db, 'file', item.id))
    : captureFolder(
      requireFolder(db, item.id),
      buildResourcePath(db, 'folder', item.id),
      foldersByParent,
      filesByParent,
      db,
    ));
}

export function canonicalizeSelection(db: Pick<ProjectDatabase, 'folders' | 'files'>, selection: AssetSelectionItem[]): AssetSelectionItem[] {
  const unique = new Map(selection.map((item) => [assetSelectionKey(item), item]));
  const selectedFolderIds = new Set(
    [...unique.values()].filter((item) => item.kind === 'folder').map((item) => item.id),
  );
  return [...unique.values()].filter((item) => {
    let parentId = item.kind === 'file'
      ? 0
      : db.folders.find((folder) => folder.id === item.id)?.parent ?? 0;
    if (item.kind === 'file') return true;
    while (parentId > 0) {
      if (selectedFolderIds.has(parentId)) return false;
      parentId = db.folders.find((folder) => folder.id === parentId)?.parent ?? 0;
    }
    return true;
  }).filter((item) => {
    if (item.kind !== 'file') return true;
    const fileParent = db.files.find((file) => file.id === item.id)?.parent ?? 0;
    let parentId = fileParent;
    while (parentId > 0) {
      if (selectedFolderIds.has(parentId)) return false;
      parentId = db.folders.find((folder) => folder.id === parentId)?.parent ?? 0;
    }
    return true;
  });
}

export function normalizePoolPath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'pool') segments.shift();
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Pool clipboard paths cannot contain traversal segments.');
  }
  return segments.length > 0 ? `/pool/${segments.join('/')}` : '/pool';
}

export function serializePoolPaths(paths: string[]): string {
  const seen = new Set<string>();
  const normalized = paths.map(normalizePoolPath).filter((path) => {
    const key = path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return normalized.join('\n');
}

export function pendingCutKeys(snapshot: AssetClipboardSnapshot | null): Set<string> {
  if (snapshot?.operation !== 'cut') return new Set();
  return new Set(snapshot.roots.map((root) => `${root.kind}:${root.sourceId}`));
}

export function resolveAssetPasteParent(db: Pick<ProjectDatabase, 'files' | 'folders'>, selection: AssetSelection): number {
  const items = getAssetSelectionItems(selection);
  if (items.length === 0) return 0;
  if (items.length > 1) throw new Error('Select a single Pool destination before pasting.');
  const item = items[0];
  if (item.kind === 'folder') {
    if (!db.folders.some((folder) => folder.id === item.id)) throw new Error('The selected destination folder no longer exists.');
    return item.id;
  }
  const file = db.files.find((candidate) => candidate.id === item.id);
  if (!file) throw new Error('The selected destination file no longer exists.');
  return file.parent;
}

export function buildResourcePath(db: Pick<ProjectDatabase, 'folders' | 'files'>, kind: 'file' | 'folder', id: number): string {
  const item = kind === 'file'
    ? db.files.find((file) => file.id === id)
    : db.folders.find((folder) => folder.id === id);
  if (!item) throw new Error(`Pool ${kind} ${id} was not found.`);
  const names = [item.name];
  let parentId = item.parent;
  const visited = new Set<number>();
  while (parentId > 0) {
    if (visited.has(parentId)) throw new Error('Pool folder hierarchy contains a cycle.');
    visited.add(parentId);
    const folder = db.folders.find((candidate) => candidate.id === parentId);
    if (!folder) break;
    names.unshift(folder.name);
    parentId = folder.parent;
  }
  return normalizePoolPath(names.join('/'));
}

function captureFolder(
  folder: DbFolder,
  path: string,
  foldersByParent: Map<number, DbFolder[]>,
  filesByParent: Map<number, DbFile[]>,
  db: ProjectDatabase,
): AssetClipboardFolder {
  return {
    kind: 'folder',
    sourceId: folder.id,
    name: folder.name,
    path,
    enabled: folder.enabled,
    children: [
      ...(foldersByParent.get(folder.id) ?? []).map((child) => captureFolder(
        child,
        buildResourcePath(db, 'folder', child.id),
        foldersByParent,
        filesByParent,
        db,
      )),
      ...(filesByParent.get(folder.id) ?? []).map((file) => captureFile(file, buildResourcePath(db, 'file', file.id))),
    ],
  };
}

function captureFile(file: DbFile, path: string): AssetClipboardFile {
  return {
    kind: 'file',
    sourceId: file.id,
    name: file.name,
    path,
    bytes: file.bytes,
    type: file.type,
    data: new Uint8Array(file.data),
    format: file.format,
    enabled: file.enabled,
  };
}

function groupByParent<T extends { parent: number }>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) groups.set(item.parent, [...(groups.get(item.parent) ?? []), item]);
  return groups;
}

function requireFile(db: ProjectDatabase, id: number): DbFile {
  const file = db.files.find((candidate) => candidate.id === id);
  if (!file) throw new Error(`Pool file ${id} was not found.`);
  return file;
}

function requireFolder(db: ProjectDatabase, id: number): DbFolder {
  const folder = db.folders.find((candidate) => candidate.id === id);
  if (!folder) throw new Error(`Pool folder ${id} was not found.`);
  return folder;
}

function normalizeClipboardText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}
