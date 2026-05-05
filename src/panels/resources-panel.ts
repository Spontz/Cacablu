import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { DbFolder, DbFile } from '../db/db-schema';
import { createContentRenderer } from './base-panel';

type FolderNode = { kind: 'folder'; id: number; name: string; children: TreeNode[] };
type FileNode = { kind: 'file'; id: number; name: string; fileType: string };
type TreeNode = FolderNode | FileNode;

// Path data per icon — 16×16 viewBox, fill only
// Each entry is an array of [d, opacity?] tuples (one per <path>)
const ICON_PATHS: Record<string, Array<[string, number?]>> = {
  'folder-closed': [
    ['M1 4a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293L8.707 4.707A1 1 0 0 0 9.414 5H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z'],
  ],
  'folder-open': [
    ['M1 4a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293L8.707 4.707A1 1 0 0 0 9.414 5H14a1 1 0 0 1 1 1v1H1V4z', 0.55],
    ['M1 7h14l-1.447 5.789A1 1 0 0 1 12.581 13H3.419a1 1 0 0 1-.972-.789L1 7z'],
  ],
  image: [
    ['M2 2h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2 12l3.5-3.5 2.5 2.5 2-2 3 3H2z'],
  ],
  video: [
    ['M2 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5l3 2v-7l-3 2V4a1 1 0 0 0-1-1H2z'],
  ],
  audio: [
    ['M6 2.5 2 5H1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1l4 2.5V2.5zM11 8a3 3 0 0 0-1.5-2.6v5.2A3 3 0 0 0 11 8zm2 0a5 5 0 0 0-2.5-4.33v1.65A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1-1.5 2.68v1.65A5 5 0 0 0 13 8z'],
  ],
  shader: [
    ['M4.72 3.22a.75.75 0 0 1 0 1.06L2.06 7l2.66 2.72a.75.75 0 0 1-1.06 1.06L.47 7.53a.75.75 0 0 1 0-1.06l3.19-3.25a.75.75 0 0 1 1.06 0zM11.28 3.22a.75.75 0 0 1 1.06 0l3.19 3.25a.75.75 0 0 1 0 1.06l-3.19 3.25a.75.75 0 0 1-1.06-1.06L13.94 7l-2.66-2.72a.75.75 0 0 1 0-1.06zM9.02 2.03a.75.75 0 0 1 .45.96l-3 9a.75.75 0 0 1-1.42-.48l3-9a.75.75 0 0 1 .97-.48z'],
  ],
  data: [
    ['M8 1C4.69 1 2 2.12 2 3.5v9C2 13.88 4.69 15 8 15s6-1.12 6-2.5v-9C14 2.12 11.31 1 8 1zm4.5 11c0 .55-1.99 1.5-4.5 1.5S3.5 12.55 3.5 12V10.7c1.08.56 2.62.8 4.5.8s3.42-.24 4.5-.8V12zm0-3.5c0 .55-1.99 1.5-4.5 1.5S3.5 9.05 3.5 8.5V7.2c1.08.56 2.62.8 4.5.8s3.42-.24 4.5-.8V8.5zm-4.5-2C5.51 6.5 3.5 5.55 3.5 5s1.99-1.5 4.5-1.5S12.5 4.45 12.5 5s-1.99 1.5-4.5 1.5z'],
  ],
  text: [
    ['M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75zM2 7.75A.75.75 0 0 1 2.75 7h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 2 7.75zM2 11.75A.75.75 0 0 1 2.75 11h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75z'],
  ],
  model3d: [
    // top face
    ['M8 1.5 14.5 5 8 8.5 1.5 5z'],
    // left face
    ['M1.5 5 8 8.5 8 14.5 1.5 11z', 0.55],
    // right face
    ['M8 8.5 14.5 5 14.5 11 8 14.5z', 0.8],
  ],
  spline: [
    // four dots suggesting a curved path: bottom-left → up → down → top-right
    ['M0.5 13 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0-3 0 M3.5 7 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0-3 0 M9.5 9 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0-3 0 M12.5 3 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0-3 0'],
  ],
  camera: [
    ['M0 5a2 2 0 0 1 2-2h.172a2 2 0 0 0 1.414-.586l.828-.828A2 2 0 0 1 5.828 1h4.344a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 13.828 3H14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5zm10.5 3a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z'],
  ],
  unknown: [
    ['M3 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5L9.5 1H3zm6 .5V5h3.5L9 1.5z'],
  ],
};

const NS = 'http://www.w3.org/2000/svg';

function createIconEl(name: string): SVGSVGElement {
  const paths = ICON_PATHS[name] ?? ICON_PATHS['unknown'];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('resources__icon', `resources__icon--${name}`);
  for (const [d, opacity] of paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', d);
    if (opacity !== undefined) path.setAttribute('opacity', String(opacity));
    svg.append(path);
  }
  return svg;
}

function fileIconName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['png','jpg','jpeg','gif','webp','svg','bmp','tga','tiff','hdr','exr'].includes(ext)) return 'image';
  if (['mp4','webm','mov','avi','mkv'].includes(ext)) return 'video';
  if (['mp3','ogg','wav','flac','aac','opus'].includes(ext)) return 'audio';
  if (['glsl','vert','frag','geom','comp','hlsl','wgsl','metal'].includes(ext)) return 'shader';
  if (['json','xml','csv','yaml','yml','toml'].includes(ext)) return 'data';
  if (['txt','md','rtf'].includes(ext)) return 'text';
  if (['lwo','lws','3ds','obj','fbx','md2','md3','dae','gltf','glb','blend'].includes(ext)) return 'model3d';
  if (ext === 'cam') return 'camera';
  if (['pth','spl','path','spline'].includes(ext)) return 'spline';
  return 'unknown';
}

function buildTree(folders: DbFolder[], files: DbFile[]): TreeNode[] {
  const folderNodes = new Map<number, FolderNode>();
  for (const f of folders) {
    folderNodes.set(f.id, { kind: 'folder', id: f.id, name: f.name, children: [] });
  }

  const roots: TreeNode[] = [];

  for (const f of folders) {
    const node = folderNodes.get(f.id)!;
    const parent = f.parent ? folderNodes.get(f.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const f of files) {
    const node: FileNode = { kind: 'file', id: f.id, name: f.name, fileType: f.type };
    const parent = f.parent ? folderNodes.get(f.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function createResourcesPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--resources';

    const expandedIds = new Set<number>();

    const placeholder = document.createElement('p');
    placeholder.className = 'resources__placeholder';
    placeholder.textContent = 'No project open.';

    const treeEl = document.createElement('div');
    treeEl.className = 'resources__tree';

    element.append(placeholder, treeEl);

    function renderNode(node: TreeNode, parent: HTMLElement): void {
      const li = document.createElement('li');
      const selection = state.getSnapshot().resourceSelection;

      if (node.kind === 'folder') {
        li.className = 'resources__folder';
        li.dataset.folderId = String(node.id);

        const row = document.createElement('div');
        row.className = 'resources__folder-row';
        row.dataset.resourceKind = 'folder';
        row.dataset.resourceId = String(node.id);
        if (selection.kind === 'folder' && selection.id === node.id) {
          row.classList.add('is-selected');
        }

        const expanded = expandedIds.has(node.id);
        row.append(
          createIconEl(expanded ? 'folder-open' : 'folder-closed'),
          Object.assign(document.createElement('span'), {
            className: 'resources__label',
            textContent: node.name,
          }),
        );
        li.append(row);

        if (expanded && node.children.length > 0) {
          const childUl = document.createElement('ul');
          childUl.className = 'resources__subtree';
          for (const child of node.children) renderNode(child, childUl);
          li.append(childUl);
        }
      } else {
        li.className = 'resources__file';
        li.dataset.resourceKind = 'file';
        li.dataset.resourceId = String(node.id);
        li.dataset.resourceName = node.name;
        li.dataset.resourceType = node.fileType;
        if (selection.kind === 'file' && selection.id === node.id) {
          li.classList.add('is-selected');
        }

        const label = document.createElement('span');
        label.className = 'resources__label';
        label.textContent = node.name;

        li.append(createIconEl(fileIconName(node.name)), label);
      }

      parent.append(li);
    }

    function render(): void {
      const db = sessionRef.current?.data ?? null;

      placeholder.style.display = db ? 'none' : '';
      treeEl.style.display = db ? '' : 'none';
      treeEl.innerHTML = '';

      if (!db) return;

      const roots = buildTree(db.folders, db.files);

      if (roots.length === 0) {
        const hint = document.createElement('p');
        hint.className = 'resources__hint';
        hint.textContent = 'No files in project.';
        treeEl.append(hint);
        return;
      }

      const ul = document.createElement('ul');
      ul.className = 'resources__list';
      for (const node of roots) renderNode(node, ul);
      treeEl.append(ul);
    }

    render();

    const unsubscribeDb = dbState.subscribe((snapshot) => {
      if (snapshot.status !== 'open') expandedIds.clear();
      render();
    });

    const unsubscribeState = state.subscribe(() => {
      render();
    });

    treeEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const file = target.closest<HTMLElement>('[data-resource-kind="file"]');
      if (file?.dataset.resourceId) {
        state.setResourceSelection({
          kind: 'file',
          id: Number(file.dataset.resourceId),
          name: file.dataset.resourceName ?? '',
          fileType: file.dataset.resourceType ?? '',
        });
        return;
      }

      const folderRow = target.closest<HTMLElement>('[data-resource-kind="folder"]');
      const folder = folderRow?.closest<HTMLElement>('[data-folder-id]');
      if (!folder?.dataset.folderId || !folderRow) return;
      const id = Number(folder.dataset.folderId);
      state.setResourceSelection({
        kind: 'folder',
        id,
        name: folderRow.querySelector<HTMLElement>('.resources__label')?.textContent ?? '',
      });
      if (expandedIds.has(id)) expandedIds.delete(id);
      else expandedIds.add(id);
      render();
    });

    return () => {
      unsubscribeDb();
      unsubscribeState();
    };
  });
}
