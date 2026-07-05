import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ConnectionController } from '../ws/connection';
import { createPhoenixAssetClient } from '../phoenix/asset-client';
import { addAssetImpactEvents } from '../phoenix/asset-impact-events';
import { deleteAllowedAssetDirectory, deleteAllowedAssetFile, writeAllowedAssetFile } from '../phoenix/asset-operations';
import { buildResourceTree, type ResourceTreeNode } from '../resources/resource-tree';
import { createContentRenderer } from './base-panel';

const ASSET_FILE_DRAG_TYPE = 'application/x-cacablu-asset-file';
const ASSET_FILE_TEXT_PREFIX = 'cacablu-asset-file:';
type AssetOperationState = 'blocked' | 'idle' | 'applying' | 'disconnected' | 'discrepant' | 'error';

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

function createDisclosureEl(expanded: boolean, visible: boolean): HTMLSpanElement {
  const disclosure = document.createElement('span');
  disclosure.className = 'resources__disclosure';
  disclosure.dataset.expanded = expanded ? 'true' : 'false';
  disclosure.setAttribute('aria-hidden', 'true');
  if (!visible) disclosure.classList.add('is-empty');
  return disclosure;
}

function createDeleteButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'resources__delete';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.draggable = false;
  return button;
}

function createEnabledCheckbox(fileName: string, checked: boolean): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'resources__enabled';
  checkbox.checked = checked;
  checkbox.setAttribute('aria-label', `Enable ${fileName} for Phoenix transfer`);
  checkbox.title = 'Transfer to Phoenix when enabled';
  checkbox.draggable = false;
  return checkbox;
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

function inferFormat(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
}

function inferMimeType(fileName: string): string {
  const format = inferFormat(fileName);
  if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(format)) return `image/${format === 'jpg' ? 'jpeg' : format}`;
  if (['mp4','webm','mov','avi','mkv'].includes(format)) return `video/${format}`;
  if (['mp3','ogg','wav','flac','aac','opus'].includes(format)) return `audio/${format}`;
  if (['txt','md','glsl','vert','frag','geom','comp','hlsl','wgsl','json','xml','csv','yaml','yml','toml'].includes(format)) return 'text/plain';
  return 'application/octet-stream';
}

export function createResourcesPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--resources';

    const expandedIds = new Set<number>();
    const phoenixAssets = createPhoenixAssetClient();
    let draggingAssetFile: AssetFileDragPayload | null = null;

    const placeholder = document.createElement('p');
    placeholder.className = 'resources__placeholder';
    placeholder.textContent = 'No project open.';

    const treeEl = document.createElement('div');
    treeEl.className = 'resources__tree';

    element.append(placeholder, treeEl);

    function renderNode(node: ResourceTreeNode, parent: HTMLElement): void {
      const li = document.createElement('li');
      const selection = state.getSnapshot().resourceSelection;

      if (node.kind === 'folder') {
        li.className = 'resources__folder';
        li.dataset.folderId = String(node.id);

        const row = document.createElement('div');
        row.className = 'resources__folder-row';
        row.dataset.resourceKind = 'folder';
        row.dataset.resourceId = String(node.id);
        row.dataset.poolPath = `pool/${node.path}`;
        if (selection.kind === 'folder' && selection.id === node.id) {
          row.classList.add('is-selected');
        }

        const expanded = expandedIds.has(node.id);
        row.append(
          createDisclosureEl(expanded, node.children.length > 0),
          createIconEl(expanded ? 'folder-open' : 'folder-closed'),
          Object.assign(document.createElement('span'), {
            className: 'resources__label',
            textContent: node.name,
          }),
          createDeleteButton(`Delete folder ${node.name}`),
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
        li.dataset.resourceType = node.type;
        li.dataset.poolPath = `pool/${node.path}`;
        li.dataset.enabled = node.enabled ? 'true' : 'false';
        li.draggable = true;
        if (selection.kind === 'file' && selection.id === node.id) {
          li.classList.add('is-selected');
        }

        const label = document.createElement('span');
        label.className = 'resources__label';
        label.textContent = node.name;

        li.append(
          createEnabledCheckbox(node.name, node.enabled),
          createIconEl(fileIconName(node.name)),
          label,
          createDeleteButton(`Delete asset ${node.name}`),
        );
      }

      parent.append(li);
    }

    function render(): void {
      const db = sessionRef.current?.data ?? null;

      placeholder.style.display = db ? 'none' : '';
      treeEl.style.display = db ? '' : 'none';
      treeEl.innerHTML = '';

      if (!db) return;

      const roots = buildResourceTree(db);

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

    function setSyncStatus(nextState: AssetOperationState, message: string): void {
      if (nextState === 'error') {
        console.warn(message);
      }
    }

    render();

    const unsubscribeDb = dbState.subscribe((snapshot) => {
      if (snapshot.status !== 'open') {
        expandedIds.clear();
      }
      render();
    });

    const unsubscribeState = state.subscribe(() => {
      render();
    });

    const unsubscribeAssets = connection.subscribeAssets((message) => {
      if (message.type === 'error' && message.requestId) {
        setSyncStatus('error', message.message);
      }
    });

    treeEl.addEventListener('dragover', (event) => {
      const target = getEventElement(event);
      const dropTarget = target ? getDropTarget(target) : null;
      if (!dropTarget) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = draggingAssetFile || hasAssetFileDrag(event.dataTransfer) ? 'move' : 'copy';
      }
    });

    treeEl.addEventListener('dragenter', (event) => {
      const target = getEventElement(event);
      if (!target) return;
      const dropTarget = getDropTarget(target);
      if (!dropTarget) return;
      dropTarget.element.classList.add('is-drop-target');
    });

    treeEl.addEventListener('dragleave', (event) => {
      const target = getEventElement(event);
      if (!target) return;
      const dropTarget = getDropTarget(target);
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (dropTarget && (!related || !dropTarget.element.contains(related))) {
        dropTarget.element.classList.remove('is-drop-target');
      }
    });

    treeEl.addEventListener('drop', (event) => {
      const target = getEventElement(event);
      if (!target) return;
      const dropTarget = getDropTarget(target);
      if (!dropTarget || !event.dataTransfer) return;
      event.preventDefault();
      dropTarget.element.classList.remove('is-drop-target');
      const assetMove = draggingAssetFile ?? getAssetFileDrag(event.dataTransfer);
      if (assetMove) {
        void moveAssetFile(dropTarget, assetMove);
        return;
      }
      if (event.dataTransfer.files.length) {
        void importDroppedFiles(dropTarget, [...event.dataTransfer.files]);
      }
    });

    treeEl.addEventListener('dragstart', (event) => {
      const target = getEventElement(event);
      if (target?.closest('.resources__enabled, .resources__delete')) return;
      const file = target?.closest<HTMLElement>('[data-resource-kind="file"]');
      if (!file?.dataset.resourceId || !file.dataset.resourceName || !file.dataset.poolPath || !event.dataTransfer) return;

      const payload: AssetFileDragPayload = {
        id: Number(file.dataset.resourceId),
        name: file.dataset.resourceName,
        sourcePath: file.dataset.poolPath,
      };
      const serialized = JSON.stringify(payload);
      draggingAssetFile = payload;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(ASSET_FILE_DRAG_TYPE, serialized);
      event.dataTransfer.setData('text/plain', `${ASSET_FILE_TEXT_PREFIX}${serialized}`);
      file.classList.add('is-dragging');
    });

    treeEl.addEventListener('dragend', () => {
      draggingAssetFile = null;
      treeEl.querySelectorAll('.is-dragging, .is-drop-target').forEach((node) => {
        node.classList.remove('is-dragging', 'is-drop-target');
      });
    });

    treeEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest<HTMLInputElement>('.resources__enabled')) {
        event.stopPropagation();
        return;
      }

      const deleteButton = target.closest<HTMLButtonElement>('.resources__delete');
      if (deleteButton) {
        const item = deleteButton.closest<HTMLElement>('[data-resource-kind="file"], [data-resource-kind="folder"]');
        if (item) {
          event.preventDefault();
          event.stopPropagation();
          void deleteAssetItem(item);
        }
        return;
      }

      const file = target.closest<HTMLElement>('[data-resource-kind="file"]');
      if (file?.dataset.resourceId) {
        const name = file.dataset.resourceName ?? '';
        state.setResourceSelection({
          kind: 'file',
          id: Number(file.dataset.resourceId),
          name,
          fileType: file.dataset.resourceType ?? '',
        });
        if (event.detail >= 2 && name.toLowerCase().endsWith('.glsl')) {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent('cacablu:open-glsl-editor', {
            detail: {
              fileId: Number(file.dataset.resourceId),
              name,
            },
          }));
        }
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

    treeEl.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement;
      const file = target.closest<HTMLElement>('[data-resource-kind="file"]');
      if (!file?.dataset.resourceId || !file.dataset.poolPath) return;
      const name = file.dataset.resourceName ?? '';
      if (!name.toLowerCase().endsWith('.glsl')) return;
      event.preventDefault();
      event.stopPropagation();
      state.setResourceSelection({
        kind: 'file',
        id: Number(file.dataset.resourceId),
        name,
        fileType: file.dataset.resourceType ?? '',
      });
      window.dispatchEvent(new CustomEvent('cacablu:open-glsl-editor', {
        detail: {
          fileId: Number(file.dataset.resourceId),
          name,
        },
      }));
    });

    treeEl.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains('resources__enabled')) return;
      const file = target.closest<HTMLElement>('[data-resource-kind="file"]');
      if (!file?.dataset.resourceId || !file.dataset.poolPath) return;
      event.stopPropagation();
      void setAssetEnabled(Number(file.dataset.resourceId), file.dataset.resourceName ?? '', file.dataset.poolPath, target.checked);
    });

    return () => {
      unsubscribeDb();
      unsubscribeState();
      unsubscribeAssets();
    };

    function getDropTarget(target: HTMLElement): DropTarget | null {
      const assetFolder = target.closest<HTMLElement>('[data-resource-kind="folder"]');
      if (assetFolder?.dataset.resourceId && assetFolder.dataset.poolPath) {
        return {
          kind: 'pool',
          element: assetFolder,
          parentId: Number(assetFolder.dataset.resourceId),
          targetPath: assetFolder.dataset.poolPath,
        };
      }

      return null;
    }

    async function importDroppedFiles(target: DropTarget, files: File[]): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('blocked', 'Load a project before importing assets.');
        return;
      }

      const regularFiles = files.filter((file) => file.size >= 0);
      if (regularFiles.length === 0) return;

      try {
        setSyncStatus('applying', `Importing ${regularFiles.length} file${regularFiles.length === 1 ? '' : 's'}...`);
        for (const file of regularFiles) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const relativePath = `${target.targetPath}/${file.name}`;

          session.upsertResourceFile({
            name: file.name,
            parent: target.parentId ?? 0,
            bytes: bytes.byteLength,
            type: file.type || inferMimeType(file.name),
            data: bytes,
            format: inferFormat(file.name),
            enabled: true,
          });

          if (connection.isConnected()) {
            addAssetImpactEvents(state, await writeAllowedAssetFile(phoenixAssets, relativePath, bytes), `Imported ${file.name}`);
          }
        }

        dbState.setDirty();
        render();
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Could not import dropped files.');
      }
    }

    async function moveAssetFile(target: DropTarget, payload: AssetFileDragPayload): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('blocked', 'Load a project before moving assets.');
        return;
      }
      if (target.parentId === undefined) {
        setSyncStatus('error', 'Assets can only be moved between Assets folders.');
        return;
      }

      const sourceFile = session.data.files.find((file) => file.id === payload.id);
      if (!sourceFile) {
        setSyncStatus('error', 'The dragged asset no longer exists in the project.');
        return;
      }
      if (sourceFile.parent === target.parentId) {
        return;
      }
      const destinationConflict = session.data.files.some((file) => (
        file.id !== payload.id
        && file.parent === target.parentId
        && file.name === payload.name
      ));
      if (destinationConflict) {
        setSyncStatus('error', `A file named ${payload.name} already exists in the destination folder.`);
        return;
      }

      const destinationPath = `${target.targetPath}/${payload.name}`;
      const bytes = new Uint8Array(sourceFile.data);

      try {
        setSyncStatus('applying', `Moving ${payload.name}...`);
        session.moveResourceFile(payload.id, target.parentId);
        dbState.setDirty();

        if (connection.isConnected() && sourceFile.enabled) {
          try {
            addAssetImpactEvents(state, await writeAllowedAssetFile(phoenixAssets, destinationPath, bytes), `Moved ${payload.name}`);
          } catch (err) {
            setSyncStatus('error', err instanceof Error ? err.message : 'Could not write Phoenix destination asset.');
          }
        }

        if (connection.isConnected() && sourceFile.enabled) {
          try {
            addAssetImpactEvents(state, await deleteAllowedAssetFile(phoenixAssets, payload.sourcePath), `Moved ${payload.name}`);
          } catch (err) {
            setSyncStatus('error', err instanceof Error ? err.message : 'Could not delete Phoenix source asset.');
          }
        }

        render();
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Could not move asset.');
      }
    }

    async function setAssetEnabled(fileId: number, name: string, poolPath: string, enabled: boolean): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('blocked', 'Load a project before changing asset state.');
        return;
      }

      try {
        setSyncStatus('applying', `${enabled ? 'Enabling' : 'Disabling'} ${name}...`);
        const file = session.setResourceFileEnabled(fileId, enabled);
        dbState.setDirty();

        if (!connection.isConnected()) {
          render();
          return;
        }

        try {
          if (enabled) {
            addAssetImpactEvents(state, await writeAllowedAssetFile(phoenixAssets, poolPath, new Uint8Array(file.data)), `Enabled ${name}`);
          } else {
            addAssetImpactEvents(state, await deleteAllowedAssetFile(phoenixAssets, poolPath), `Disabled ${name}`);
          }
        } catch (err) {
          setSyncStatus('discrepant', `Updated in Cacablu, but Phoenix did not apply it: ${err instanceof Error ? err.message : 'Could not update Phoenix asset state.'}`);
          render();
          return;
        }

        render();
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Could not change asset state.');
        render();
      }
    }

    async function deleteAssetItem(item: HTMLElement): Promise<void> {
      const id = Number(item.dataset.resourceId);
      const name = item.dataset.resourceName
        ?? item.querySelector<HTMLElement>('.resources__label')?.textContent
        ?? 'item';
      const path = item.dataset.poolPath;
      if (!Number.isFinite(id) || !path) return;

      if (item.dataset.resourceKind === 'file') {
        const confirmed = window.confirm(`Delete asset "${name}" from the project database and Phoenix?`);
        if (!confirmed) return;
        await deleteAssetFile(id, name, path);
        return;
      }

      if (item.dataset.resourceKind === 'folder') {
        const confirmed = window.confirm(`Delete folder "${name}" and all its contents from the project database and Phoenix?`);
        if (!confirmed) return;
        await deleteAssetFolder(id, name, path);
      }
    }

    async function deleteAssetFile(fileId: number, name: string, poolPath: string): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('blocked', 'Load a project before deleting assets.');
        return;
      }

      try {
        setSyncStatus('applying', `Deleting ${name}...`);
        session.deleteResourceFile(fileId);
        dbState.setDirty();
        state.clearResourceSelection();

        if (connection.isConnected()) {
          try {
            addAssetImpactEvents(state, await deleteAllowedAssetFile(phoenixAssets, poolPath), `Deleted ${name}`);
          } catch (err) {
            setSyncStatus('error', err instanceof Error ? err.message : 'Could not delete Phoenix asset.');
          }
        }

        render();
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Could not delete asset.');
      }
    }

    async function deleteAssetFolder(folderId: number, name: string, poolPath: string): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('blocked', 'Load a project before deleting asset folders.');
        return;
      }

      try {
        setSyncStatus('applying', `Deleting ${name}...`);
        session.deleteResourceFolder(folderId);
        expandedIds.delete(folderId);
        dbState.setDirty();
        state.clearResourceSelection();

        if (connection.isConnected()) {
          try {
            addAssetImpactEvents(state, await deleteAllowedAssetDirectory(phoenixAssets, poolPath, true), `Deleted folder ${name}`);
          } catch (err) {
            setSyncStatus('error', err instanceof Error ? err.message : 'Could not delete Phoenix asset folder.');
          }
        }

        render();
      } catch (err) {
        setSyncStatus('error', err instanceof Error ? err.message : 'Could not delete asset folder.');
      }
    }
  });
}

interface DropTarget {
  kind: 'pool' | 'resources';
  element: HTMLElement;
  targetPath: string;
  parentId?: number;
}

interface AssetFileDragPayload {
  id: number;
  name: string;
  sourcePath: string;
}

function getEventElement(event: Event): HTMLElement | null {
  return event.target instanceof HTMLElement ? event.target : null;
}

function hasAssetFileDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes(ASSET_FILE_DRAG_TYPE));
}

function getAssetFileDrag(dataTransfer: DataTransfer): AssetFileDragPayload | null {
  const custom = dataTransfer.getData(ASSET_FILE_DRAG_TYPE);
  const plain = dataTransfer.getData('text/plain');
  const raw = custom || (plain.startsWith(ASSET_FILE_TEXT_PREFIX) ? plain.slice(ASSET_FILE_TEXT_PREFIX.length) : '');
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<AssetFileDragPayload>;
    if (
      typeof payload.id !== 'number'
      || !Number.isFinite(payload.id)
      || typeof payload.name !== 'string'
      || typeof payload.sourcePath !== 'string'
    ) {
      return null;
    }
    return {
      id: payload.id,
      name: payload.name,
      sourcePath: payload.sourcePath,
    };
  } catch {
    return null;
  }
}
