import type { DbFile, DbFolder, ProjectDatabase } from '../db/db-schema';

export interface ResourceFolderNode {
  kind: 'folder';
  id: number;
  name: string;
  path: string;
  enabled: boolean;
  children: ResourceTreeNode[];
}

export interface ResourceFileNode {
  kind: 'file';
  id: number;
  name: string;
  path: string;
  parentId: number;
  type: string;
  format: string;
  bytes: number;
  enabled: boolean;
}

export type ResourceTreeNode = ResourceFolderNode | ResourceFileNode;

type DraftNode = FolderDraft | ResourceFileNode;

type FolderDraft = Omit<ResourceFolderNode, 'path' | 'children'> & {
  parentId: number;
  children: DraftNode[];
};

export function buildResourceTree(db: Pick<ProjectDatabase, 'folders' | 'files'>): ResourceTreeNode[] {
  const folderNodes = new Map<number, FolderDraft>();

  for (const folder of db.folders) {
    folderNodes.set(folder.id, {
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      parentId: normalizeParentId(folder),
      enabled: folder.enabled,
      children: [],
    });
  }

  const roots: DraftNode[] = [];

  for (const folder of db.folders) {
    const node = folderNodes.get(folder.id);
    if (!node) continue;

    const parent = node.parentId ? folderNodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const file of db.files) {
    const parentId = normalizeParentId(file);
    const node: ResourceFileNode = {
      kind: 'file',
      id: file.id,
      name: file.name,
      path: '',
      parentId,
      type: file.type,
      format: file.format,
      bytes: file.bytes,
      enabled: file.enabled,
    };

    const parent = parentId ? folderNodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots.map((node) => finalizePath(node, ''));
}

export function escapeResourcePathSegment(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/\//g, '\\/');
}

function finalizePath(node: FolderDraft | ResourceFileNode, parentPath: string): ResourceTreeNode {
  const segment = escapeResourcePathSegment(node.name);
  const path = parentPath ? `${parentPath}/${segment}` : segment;

  if (node.kind === 'file') {
    return { ...node, path };
  }

  return {
    kind: 'folder',
    id: node.id,
    name: node.name,
    path,
    enabled: node.enabled,
    children: node.children.map((child) => finalizePath(child, path)),
  };
}

function normalizeParentId(input: Pick<DbFolder | DbFile, 'parent'>): number {
  return Number.isFinite(input.parent) && input.parent > 0 ? input.parent : 0;
}
