import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import { validateResourceItemName } from '../db/db-session';
import type { DbSession, DbSessionRef, ResourceClipboardMutation, ResourceDeletionSnapshot, ResourceItemRef, ResourceScriptEdit } from '../db/db-session';
import type { UndoManager } from '../app/undo-manager';
import type { ConnectionController } from '../ws/connection';
import { createPhoenixAssetClient } from '../phoenix/asset-client';
import { createPhoenixSectionClient } from '../phoenix/section-client';
import { addAssetImpactEvents } from '../phoenix/asset-impact-events';
import { deleteAllowedAssetFile, writeAllowedAssetFile } from '../phoenix/asset-operations';
import { buildResourceTree, type ResourceTreeNode } from '../resources/resource-tree';
import type { AssetClipboard, AssetClipboardNode } from '../resources/asset-clipboard';
import {
  normalizePoolPath,
  pendingCutKeys,
  resolveAssetPasteParent,
  validateAssetCopyDestination,
} from '../resources/asset-clipboard';
import {
  createAssetRangeSelection,
  createAssetSelection,
  getAssetSelectionItems,
  isAssetSelected,
  toggleAssetSelection,
} from '../resources/asset-selection';
import type { AssetSelectionItem } from '../app/types';
import { syncResourceClipboardMutation } from '../services/resource-clipboard-sync';
import { ProjectSectionSyncError, syncProjectBarToPhoenix } from '../services/project-section-sync';
import { writeSystemClipboardText } from '../resources/system-clipboard';
import {
  createPoolClipboardEnvelope,
  writeEnvelopeToDataTransfer,
  writeEnvelopeToSystemClipboard,
} from '../services/cross-project-clipboard';
import { ASSET_FILE_DRAG_TYPE } from '../resources/pool-path-drop';
import { createMenuIcon } from '../menu/menu-icon';
import { createContentRenderer } from './base-panel';

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

function createActionButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'resources__actions-button';
  button.dataset.resourceActions = 'true';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.draggable = false;
  button.textContent = '⋮';
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
  undoManager: UndoManager,
  assetClipboard: AssetClipboard,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--resources';

    const expandedIds = new Set<number>();
    const phoenixAssets = createPhoenixAssetClient();
    const phoenixSections = createPhoenixSectionClient();
    let draggingAssetFile: AssetFileDragPayload | null = null;
    let selectionAnchor: AssetSelectionItem | null = null;
    let actionMenu: HTMLElement | null = null;
    let actionTarget: ResourceActionTarget | null = null;
    let observedSession = sessionRef.current;

    const placeholder = document.createElement('p');
    placeholder.className = 'resources__placeholder';
    placeholder.textContent = 'No project open.';

    const treeEl = document.createElement('div');
    treeEl.className = 'resources__tree';

    element.append(placeholder, treeEl);

    function renderNode(node: ResourceTreeNode, parent: HTMLElement): void {
      const li = document.createElement('li');
      const selection = state.getSnapshot().assetSelection;

      if (node.kind === 'folder') {
        li.className = 'resources__folder';
        li.dataset.folderId = String(node.id);

        const row = document.createElement('div');
        row.className = 'resources__folder-row';
        row.dataset.resourceKind = 'folder';
        row.dataset.resourceId = String(node.id);
        row.dataset.poolPath = `pool/${node.path}`;
        if (isAssetSelected(selection, 'folder', node.id)) {
          row.classList.add('is-selected');
        }
        if (pendingCutKeys(assetClipboard.getSnapshot()).has(`folder:${node.id}`)) row.classList.add('is-cut-pending');

        const expanded = expandedIds.has(node.id);
        row.append(
          createDisclosureEl(expanded, node.children.length > 0),
          createIconEl(expanded ? 'folder-open' : 'folder-closed'),
          Object.assign(document.createElement('span'), {
            className: 'resources__label',
            textContent: node.name,
          }),
          createActionButton(`Actions for folder ${node.name}`),
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
        if (isAssetSelected(selection, 'file', node.id)) {
          li.classList.add('is-selected');
        }
        if (pendingCutKeys(assetClipboard.getSnapshot()).has(`file:${node.id}`)) li.classList.add('is-cut-pending');

        const label = document.createElement('span');
        label.className = 'resources__label';
        label.textContent = node.name;

        li.append(
          createEnabledCheckbox(node.name, node.enabled),
          createIconEl(fileIconName(node.name)),
          label,
          createActionButton(`Actions for file ${node.name}`),
        );
      }

      parent.append(li);
    }

    function render(): void {
      const db = sessionRef.current?.data ?? null;

      if (sessionRef.current !== observedSession) {
        observedSession = sessionRef.current;
        closeActionMenu();
      } else if (actionTarget && actionTarget.kind !== 'root' && db) {
        const exists = actionTarget.kind === 'file'
          ? db.files.some((file) => file.id === actionTarget?.id)
          : db.folders.some((folder) => folder.id === actionTarget?.id);
        if (!exists) closeActionMenu();
      }

      placeholder.style.display = db ? 'none' : '';
      treeEl.style.display = db ? '' : 'none';
      treeEl.innerHTML = '';

      if (!db) return;

      const roots = buildResourceTree(db);

      const poolRoot = document.createElement('div');
      poolRoot.className = 'resources__pool-root';
      poolRoot.dataset.poolRoot = 'true';

      const rootRow = document.createElement('div');
      rootRow.className = 'resources__root-row';
      if (state.getSnapshot().assetSelection.kind === 'none') rootRow.classList.add('is-selected');
      rootRow.append(
        createIconEl('folder-open'),
        Object.assign(document.createElement('span'), {
          className: 'resources__label',
          textContent: 'pool',
        }),
        createActionButton('Actions for Pool root'),
      );
      poolRoot.append(rootRow);
      treeEl.append(poolRoot);

      if (roots.length === 0) {
        const hint = document.createElement('p');
        hint.className = 'resources__hint';
        hint.textContent = 'No files in project.';
        poolRoot.append(hint);
        return;
      }

      const ul = document.createElement('ul');
      ul.className = 'resources__list';
      for (const node of roots) renderNode(node, ul);
      poolRoot.append(ul);
    }

    function setSyncStatus(nextState: AssetOperationState, message: string): void {
      if (nextState !== 'error' && nextState !== 'discrepant') return;
      state.addEvent({
        severity: nextState === 'error' ? 'error' : 'warning',
        source: 'Pool assets',
        description: message,
      });
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

    const unsubscribeClipboard = assetClipboard.subscribe(() => {
      render();
    });

    const unsubscribeAssets = connection.subscribeAssets((message) => {
      if (message.type === 'error' && message.requestId) {
        setSyncStatus('error', message.message);
      }
    });

    const dismissActionMenu = (event: Event) => {
      if (actionMenu?.contains(event.target as Node)) return;
      closeActionMenu();
    };
    const dismissActionMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeActionMenu();
    };
    document.addEventListener('pointerdown', dismissActionMenu);
    document.addEventListener('keydown', dismissActionMenuOnEscape);

    treeEl.addEventListener('pointerdown', (event) => {
      const button = getEventElement(event)?.closest<HTMLButtonElement>('[data-resource-actions]');
      if (!button) return;
      event.stopPropagation();
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
      if (target?.closest('.resources__enabled, .resources__actions-button')) return;
      const file = target?.closest<HTMLElement>('[data-resource-kind="file"]');
      if (!file?.dataset.resourceId || !file.dataset.resourceName || !file.dataset.poolPath || !event.dataTransfer) return;

      const payload: AssetFileDragPayload = {
        id: Number(file.dataset.resourceId),
        name: file.dataset.resourceName,
        sourcePath: file.dataset.poolPath,
      };
      const serialized = JSON.stringify(payload);
      draggingAssetFile = payload;
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData(ASSET_FILE_DRAG_TYPE, serialized);
      event.dataTransfer.setData('text/plain', normalizePoolPath(payload.sourcePath));
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

      const actionButton = target.closest<HTMLButtonElement>('[data-resource-actions]');
      if (actionButton) {
        event.preventDefault();
        event.stopPropagation();
        const captured = captureActionTarget(actionButton);
        if (!captured) return;
        const anchorRect = actionButton.getBoundingClientRect();
        if (captured.kind === 'root') {
          selectionAnchor = null;
          state.clearAssetSelection();
        } else {
          const selected = resourceActionTargetToSelection(captured, sessionRef.current);
          if (selected) {
            state.setAssetSelection(selected);
            selectionAnchor = selected;
          }
        }
        openActionMenu(captured, anchorRect);
        return;
      }

      const file = target.closest<HTMLElement>('[data-resource-kind="file"]');
      if (file?.dataset.resourceId) {
        const name = file.dataset.resourceName ?? '';
        const item: AssetSelectionItem = {
          kind: 'file',
          id: Number(file.dataset.resourceId),
          name,
          fileType: file.dataset.resourceType ?? '',
        };
        updateAssetSelection(event, item);
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
      if (!folder?.dataset.folderId || !folderRow) {
        if (target.closest('.resources__root-row')) {
          selectionAnchor = null;
          state.clearAssetSelection();
        }
        return;
      }
      const id = Number(folder.dataset.folderId);
      const item: AssetSelectionItem = {
        kind: 'folder',
        id,
        name: folderRow.querySelector<HTMLElement>('.resources__label')?.textContent ?? '',
      };
      updateAssetSelection(event, item);
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (expandedIds.has(id)) expandedIds.delete(id);
        else expandedIds.add(id);
      }
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
      state.setAssetSelection({
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

    const handleClipboardCommand = (event: Event) => {
      if (state.getSnapshot().activePanelId !== 'resources') return;
      const detail = event instanceof CustomEvent
        ? event.detail as {
            command?: unknown;
            clipboardData?: DataTransfer | null;
            externalRoots?: AssetClipboardNode[];
          }
        : null;
      if (detail?.command !== 'copy' && detail?.command !== 'cut' && detail?.command !== 'paste') return;
      event.preventDefault();
      if (detail.command === 'paste') void pasteAssetClipboard(undefined, detail.externalRoots);
      else void captureAssetClipboard(detail.command, detail.clipboardData);
    };
    window.addEventListener('cacablu:asset-clipboard-command', handleClipboardCommand);

    return () => {
      unsubscribeDb();
      unsubscribeState();
      unsubscribeClipboard();
      unsubscribeAssets();
      window.removeEventListener('cacablu:asset-clipboard-command', handleClipboardCommand);
      document.removeEventListener('pointerdown', dismissActionMenu);
      document.removeEventListener('keydown', dismissActionMenuOnEscape);
      closeActionMenu();
    };

    function captureActionTarget(button: HTMLButtonElement): ResourceActionTarget | null {
      const item = button.closest<HTMLElement>('[data-resource-kind][data-resource-id]');
      if (!item) return button.closest('[data-pool-root]')
        ? { kind: 'root', id: 0, name: 'pool', path: 'pool', parentId: 0 }
        : null;
      const kind = item.dataset.resourceKind;
      const id = Number(item.dataset.resourceId);
      const path = item.dataset.poolPath;
      if ((kind !== 'file' && kind !== 'folder') || !Number.isInteger(id) || !path) return null;
      const session = sessionRef.current;
      const row = kind === 'file'
        ? session?.data.files.find((candidate) => candidate.id === id)
        : session?.data.folders.find((candidate) => candidate.id === id);
      if (!row) return null;
      return { kind, id, name: row.name, path, parentId: row.parent };
    }

    function openActionMenu(target: ResourceActionTarget, anchor: DOMRect): void {
      closeActionMenu();
      actionTarget = target;
      const menu = document.createElement('div');
      menu.className = 'resources__actions-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', `${target.name} actions`);
      const actions: Array<{ id: ResourceAction; label: string }> = target.kind === 'root'
        ? [
            { id: 'new-folder', label: 'New Folder' },
            { id: 'paste', label: 'Paste' },
          ]
        : target.kind === 'folder'
          ? [
              { id: 'new-folder', label: 'New Folder' },
              { id: 'cut', label: 'Cut' },
              { id: 'copy', label: 'Copy' },
              { id: 'paste', label: 'Paste' },
              { id: 'rename', label: 'Rename' },
              { id: 'delete', label: 'Delete' },
            ]
          : [
              { id: 'cut', label: 'Cut' },
              { id: 'copy', label: 'Copy' },
              { id: 'rename', label: 'Rename' },
              { id: 'delete', label: 'Delete' },
            ];
      for (const [index, action] of actions.entries()) {
        if (action.id === 'delete' || (index > 0 && actions[index - 1]?.id === 'new-folder')) {
          const separator = document.createElement('div');
          separator.className = 'resources__actions-menu-separator';
          separator.setAttribute('role', 'separator');
          menu.append(separator);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'resources__actions-menu-item';
        button.dataset.resourceAction = action.id;
        button.setAttribute('role', 'menuitem');
        const label = document.createElement('span');
        label.textContent = action.label;
        button.append(createMenuIcon(action.id), label);
        button.addEventListener('click', () => {
          const capturedTarget = actionTarget;
          closeActionMenu();
          if (capturedTarget) void runResourceAction(action.id, capturedTarget);
        });
        menu.append(button);
      }
      actionMenu = menu;
      // Dockview panels clip their contents. Render the fixed menu at document
      // level so it remains visible when it opens beyond the Resources panel.
      document.body.append(menu);
      positionActionMenu(menu, anchor);
      menu.querySelector<HTMLButtonElement>('button')?.focus();
    }

    function positionActionMenu(menu: HTMLElement, anchor: DOMRect): void {
      const viewportMargin = 6;
      const anchorGap = 2;
      const bounds = menu.getBoundingClientRect();
      const preferredLeft = anchor.right + anchorGap;
      const maximumLeft = window.innerWidth - bounds.width - viewportMargin;
      menu.style.left = `${Math.max(viewportMargin, Math.min(preferredLeft, maximumLeft))}px`;

      const below = anchor.bottom + anchorGap;
      const above = anchor.top - bounds.height - anchorGap;
      menu.style.top = `${below + bounds.height <= window.innerHeight - viewportMargin
        ? below
        : Math.max(viewportMargin, above)}px`;
    }

    function closeActionMenu(): void {
      actionMenu?.remove();
      actionMenu = null;
      actionTarget = null;
    }

    async function runResourceAction(action: ResourceAction, target: ResourceActionTarget): Promise<void> {
      if (action === 'new-folder') await createFolder(target.kind === 'folder' ? target.id : 0);
      else if ((action === 'cut' || action === 'copy') && target.kind !== 'root') {
        const selected = resourceActionTargetToSelection(target, sessionRef.current);
        if (selected) await captureAssetClipboard(action, null, [selected]);
      } else if (action === 'paste' && target.kind !== 'file') {
        await pasteAssetClipboard(target.kind === 'folder' ? target.id : 0);
      } else if (action === 'rename' && target.kind !== 'root') await renameAssetItem(target);
      else if (action === 'delete' && target.kind !== 'root') await deleteAssetItem(target);
    }

    async function createFolder(parentId: number): Promise<void> {
      const session = sessionRef.current;
      if (!session) return;
      const name = await showResourceNameDialog(
        'New Folder',
        'Folder name',
        '',
        (candidate) => validateResourceItemName(session.data, parentId, candidate),
      );
      if (name === null) return;
      const wasDirty = dbState.getSnapshot().isDirty;
      try {
        const folder = session.createResourceFolder(parentId, name);
        dbState.setDirty();
        if (parentId > 0) expandedIds.add(parentId);
        state.setAssetSelection({ kind: 'folder', id: folder.id, name: folder.name });
        undoManager.push({
          label: `Create folder ${folder.name}`,
          undo: () => {
            if (session.data.folders.some((candidate) => candidate.parent === folder.id)
              || session.data.files.some((candidate) => candidate.parent === folder.id)) {
              throw new Error(`Cannot undo creation of ${folder.name} because the folder is no longer empty.`);
            }
            session.deleteResourceItems([{ kind: 'folder', id: folder.id }]);
            restoreDirtyState(wasDirty);
            state.clearAssetSelection();
            render();
          },
        });
        render();
      } catch (error) {
        setSyncStatus('error', error instanceof Error ? error.message : 'Could not create the Pool folder.');
      }
    }

    async function renameAssetItem(target: Exclude<ResourceActionTarget, { kind: 'root' }>): Promise<void> {
      const session = sessionRef.current;
      if (!session) return;
      const name = await showResourceNameDialog(
        `Rename ${target.name}`,
        'New name',
        target.name,
        (candidate) => validateResourceItemName(session.data, target.parentId, candidate, { kind: target.kind, id: target.id }),
      );
      if (name === null) return;
      try {
        const item: ResourceItemRef = { kind: target.kind, id: target.id };
        const references = session.findResourceScriptReferences(item);
        let updateScripts = false;
        if (references.length > 0) {
          const count = references.reduce((sum, reference) => sum + reference.occurrences, 0);
          const choice = await showRenamePathDialog(count);
          if (choice === null) return;
          updateScripts = choice === 'update';
        }
        const wasDirty = dbState.getSnapshot().isDirty;
        const result = session.renameResourceItem(item, name, updateScripts);
        if (result.oldName === result.newName) return;
        dbState.setDirty();
        undoManager.push({
          label: `Rename ${result.oldName}`,
          undo: async () => {
            const inverse = session.restoreResourceRename(result);
            restoreDirtyState(wasDirty);
            await syncResourceClipboardMutation(
              renameAsClipboardMutation(inverse),
              phoenixAssets,
              state,
              connection.isConnected(),
              { beforeDelete: () => syncRenamedSections(session, inverse.scripts) },
            );
            render();
          },
        });
        await syncResourceClipboardMutation(
          renameAsClipboardMutation(result),
          phoenixAssets,
          state,
          connection.isConnected(),
          { beforeDelete: () => syncRenamedSections(session, result.scripts) },
        );
        const selected = resourceActionTargetToSelection({ ...target, name: result.newName }, session);
        if (selected) state.setAssetSelection(selected);
        render();
      } catch (error) {
        setSyncStatus('error', error instanceof Error ? error.message : 'Could not rename the Pool item.');
      }
    }

    function restoreDirtyState(wasDirty: boolean): void {
      if (wasDirty) dbState.setDirty();
      else dbState.setSaved();
    }

    async function syncRenamedSections(session: DbSession, scriptEdits: ResourceScriptEdit[]): Promise<boolean> {
      const barIds = [...new Set(scriptEdits.map((edit) => edit.barId))];
      let succeeded = true;
      for (const barId of barIds) {
        try {
          const result = await syncProjectBarToPhoenix(session.data, barId, phoenixSections);
          if (result.issues.length > 0) {
            succeeded = false;
            state.markSectionErrors(result.issues.map((issue) => issue.barId));
            for (const issue of result.issues) {
              state.addEvent({
                severity: 'error',
                source: 'Phoenix section sync',
                subjectId: String(issue.barId),
                description: issue.description,
              });
            }
          } else {
            state.clearSectionErrors([barId]);
            state.clearEventsForSubjects([String(barId)], ['Phoenix section sync', 'Phoenix asset impact', 'Phoenix log']);
          }
        } catch (error) {
          succeeded = false;
          const issues = error instanceof ProjectSectionSyncError ? error.issues : [];
          state.markSectionErrors(issues.length > 0 ? issues.map((issue) => issue.barId) : [barId]);
          state.addEvent({
            severity: 'error',
            source: 'Phoenix section sync',
            subjectId: String(barId),
            description: error instanceof Error ? error.message : `Could not reload renamed section ${barId}.`,
          });
        }
      }
      return succeeded;
    }

    function updateAssetSelection(event: MouseEvent, item: AssetSelectionItem): void {
      const current = state.getSnapshot().assetSelection;
      if (event.shiftKey) {
        state.setAssetSelection(createAssetRangeSelection(getVisibleAssetItems(), selectionAnchor, item));
      } else if (event.ctrlKey || event.metaKey) {
        state.setAssetSelection(toggleAssetSelection(current, item));
        selectionAnchor = item;
      } else {
        state.setAssetSelection(item);
        selectionAnchor = item;
      }
    }

    function getVisibleAssetItems(): AssetSelectionItem[] {
      return [...treeEl.querySelectorAll<HTMLElement>('[data-resource-kind][data-resource-id]')]
        .map(resourceElementToSelection)
        .filter((item): item is AssetSelectionItem => item !== null);
    }

    async function captureAssetClipboard(
      operation: 'copy' | 'cut',
      clipboardData?: DataTransfer | null,
      explicitSelection?: AssetSelectionItem[],
    ): Promise<void> {
      const session = sessionRef.current;
      if (!session) {
        setSyncStatus('error', 'Load a project before using the Pool clipboard.');
        return;
      }
      const selected = explicitSelection ?? getAssetSelectionItems(state.getSnapshot().assetSelection);
      if (selected.length === 0) {
        setSyncStatus('error', 'Select at least one Pool item to copy or cut.');
        return;
      }

      try {
        const snapshot = assetClipboard.capture(operation, session, session.data, selected);
        if (operation === 'copy') {
          const envelope = createPoolClipboardEnvelope(snapshot.roots);
          if (clipboardData) {
            writeEnvelopeToDataTransfer(clipboardData, envelope);
            return;
          }
          await writeEnvelopeToSystemClipboard(envelope);
          return;
        }
        if (clipboardData) {
          clipboardData.setData('text/plain', snapshot.text);
          return;
        }
        await writeSystemClipboardText(snapshot.text);
      } catch (error) {
        state.addEvent({
          severity: 'error',
          source: 'Pool clipboard',
          description: error instanceof Error ? error.message : 'Could not copy Pool items.',
        });
      }
    }

    async function pasteAssetClipboard(
      explicitParentId?: number,
      externalRoots?: AssetClipboardNode[],
    ): Promise<void> {
      const session = sessionRef.current;
      const snapshot = assetClipboard.getSnapshot();
      if (!session || (!snapshot && !externalRoots)) {
        setSyncStatus('error', 'The Pool clipboard is empty.');
        return;
      }

      try {
        const parentId = explicitParentId ?? resolveAssetPasteParent(session.data, state.getSnapshot().assetSelection);
        const operation = externalRoots ? 'copy' : snapshot!.operation;
        const roots = externalRoots ?? snapshot!.roots;
        const sourceSession = externalRoots ? null : snapshot!.sourceSession;
        const wasDirty = dbState.getSnapshot().isDirty;
        const previousParents = operation === 'cut'
          ? roots.map((root) => {
              const row = root.kind === 'file'
                ? session.data.files.find((candidate) => candidate.id === root.sourceId)
                : session.data.folders.find((candidate) => candidate.id === root.sourceId);
              if (!row) throw new Error(`The cut Pool ${root.kind} is no longer available.`);
              return { kind: root.kind, id: root.sourceId, parentId: row.parent };
            })
          : [];
        let result: ResourceClipboardMutation;
        if (operation === 'copy') {
          if (sourceSession === session) {
            validateAssetCopyDestination(session.data, roots, parentId);
          }
          result = session.copyResourceItems(roots, parentId);
        } else {
          if (sourceSession !== session) {
            assetClipboard.clear();
            throw new Error('The cut Pool items belong to a project that is no longer open.');
          }
          result = session.moveResourceItems(
            roots.map((root) => ({ kind: root.kind, id: root.sourceId })),
            parentId,
          );
        }

        dbState.setDirty();
        state.setAssetSelection(createAssetSelection(result.roots.map((root) => resourceRefToSelection(session, root))));
        if (operation === 'cut') assetClipboard.consumeCut();
        if (result.operation === 'copy') {
          const pastedSnapshot = session.snapshotResourceItems(result.roots);
          undoManager.push({
            label: 'Paste Pool items',
            undo: async () => {
              const deleted = session.deleteResourceItems(result.roots, pastedSnapshot);
              restoreDirtyState(wasDirty);
              await syncDeletedResourceItems(deleted);
              render();
            },
          });
        } else {
          undoManager.push({
            label: 'Move Pool items',
            undo: async () => {
              const inverse = session.moveResourceItemsToParents(previousParents);
              restoreDirtyState(wasDirty);
              await syncResourceClipboardMutation(inverse, phoenixAssets, state, connection.isConnected());
              render();
            },
          });
        }
        render();
        await syncResourceClipboardMutation(result, phoenixAssets, state, connection.isConnected());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not paste Pool items.';
        if (snapshot?.operation === 'cut' && /no longer|no longer open/i.test(message)) assetClipboard.clear();
        setSyncStatus('error', message);
      }
    }

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

      const poolRoot = target.closest<HTMLElement>('[data-pool-root]');
      if (poolRoot) {
        return {
          kind: 'pool',
          element: poolRoot.querySelector<HTMLElement>('.resources__root-row') ?? poolRoot,
          parentId: 0,
          targetPath: 'pool',
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

    async function deleteAssetItem(target: Exclude<ResourceActionTarget, { kind: 'root' }>): Promise<void> {
      const session = sessionRef.current;
      if (!session) return;
      const description = target.kind === 'folder'
        ? `Delete folder "${target.name}" and all its contents?`
        : `Delete asset "${target.name}"?`;
      if (!window.confirm(description)) return;
      const wasDirty = dbState.getSnapshot().isDirty;
      try {
        const deleted = session.deleteResourceItems([{ kind: target.kind, id: target.id }]);
        if (target.kind === 'folder') expandedIds.delete(target.id);
        dbState.setDirty();
        state.clearAssetSelection();
        undoManager.push({
          label: `Delete ${target.name}`,
          undo: async () => {
            const restored = session.restoreResourceItems(deleted);
            restoreDirtyState(wasDirty);
            await syncResourceClipboardMutation(restored, phoenixAssets, state, connection.isConnected());
            render();
          },
        });
        await syncDeletedResourceItems(deleted);
        render();
      } catch (error) {
        setSyncStatus('error', error instanceof Error ? error.message : 'Could not delete the Pool item.');
      }
    }

    async function syncDeletedResourceItems(deleted: ResourceDeletionSnapshot): Promise<void> {
      if (!connection.isConnected()) return;
      for (const entry of deleted.files) {
        if (!entry.row.enabled) continue;
        try {
          addAssetImpactEvents(state, await deleteAllowedAssetFile(phoenixAssets, entry.path), `Deleted ${entry.row.name}`);
        } catch (error) {
          setSyncStatus('discrepant', `Project updated, but Phoenix could not delete ${entry.path}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }
  });
}

type ResourceAction = 'new-folder' | 'cut' | 'copy' | 'paste' | 'rename' | 'delete';
type ResourceActionTarget =
  | { kind: 'root'; id: 0; name: 'pool'; path: 'pool'; parentId: 0 }
  | { kind: 'file' | 'folder'; id: number; name: string; path: string; parentId: number };

function resourceActionTargetToSelection(
  target: Exclude<ResourceActionTarget, { kind: 'root' }>,
  session: DbSession | null,
): AssetSelectionItem | null {
  if (!session) return null;
  if (target.kind === 'file') {
    const file = session.data.files.find((candidate) => candidate.id === target.id);
    return file ? { kind: 'file', id: file.id, name: file.name, fileType: file.type } : null;
  }
  const folder = session.data.folders.find((candidate) => candidate.id === target.id);
  return folder ? { kind: 'folder', id: folder.id, name: folder.name } : null;
}

function renameAsClipboardMutation(result: {
  item: ResourceItemRef;
  files: ResourceClipboardMutation['files'];
}): ResourceClipboardMutation {
  return { operation: 'move', roots: [result.item], files: result.files };
}

function showResourceNameDialog(
  title: string,
  label: string,
  value: string,
  validate: (value: string) => string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'resources__dialog';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const inputLabel = document.createElement('label');
    inputLabel.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.autocomplete = 'off';
    inputLabel.append(input);
    const errorMessage = document.createElement('p');
    errorMessage.className = 'resources__dialog-error';
    errorMessage.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'resources__dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = title === 'New Folder' ? 'Create' : 'Rename';
    confirm.className = 'is-primary';
    actions.append(cancel, confirm);
    dialog.append(heading, inputLabel, errorMessage, actions);
    document.body.append(dialog);
    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    cancel.addEventListener('click', () => finish(null));
    const submit = () => {
      try {
        finish(validate(input.value));
      } catch (error) {
        errorMessage.textContent = error instanceof Error ? error.message : 'Invalid name.';
        input.focus();
      }
    };
    confirm.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.showModal();
    input.focus();
    input.select();
  });
}

function showRenamePathDialog(referenceCount: number): Promise<'update' | 'keep' | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'resources__dialog';
    const heading = document.createElement('h3');
    heading.textContent = 'Update script paths?';
    const message = document.createElement('p');
    message.textContent = `${referenceCount} matching script reference${referenceCount === 1 ? '' : 's'} found.`;
    const actions = document.createElement('div');
    actions.className = 'resources__dialog-actions resources__dialog-actions--stacked';
    const choices: Array<{ value: 'update' | 'keep' | null; label: string; primary?: boolean }> = [
      { value: 'update', label: 'Rename and Update Script Paths', primary: true },
      { value: 'keep', label: 'Rename and Keep Script Paths' },
      { value: null, label: 'Cancel' },
    ];
    let settled = false;
    const finish = (value: 'update' | 'keep' | null) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      if (choice.primary) button.className = 'is-primary';
      button.addEventListener('click', () => finish(choice.value));
      actions.append(button);
    }
    dialog.append(heading, message, actions);
    document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.showModal();
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

function resourceElementToSelection(element: HTMLElement): AssetSelectionItem | null {
  const id = Number(element.dataset.resourceId);
  if (!Number.isInteger(id)) return null;
  if (element.dataset.resourceKind === 'file') {
    return {
      kind: 'file',
      id,
      name: element.dataset.resourceName ?? '',
      fileType: element.dataset.resourceType ?? '',
    };
  }
  if (element.dataset.resourceKind === 'folder') {
    return {
      kind: 'folder',
      id,
      name: element.querySelector<HTMLElement>('.resources__label')?.textContent ?? '',
    };
  }
  return null;
}

function resourceRefToSelection(session: DbSession, ref: ResourceItemRef): AssetSelectionItem {
  if (ref.kind === 'file') {
    const file = session.data.files.find((candidate) => candidate.id === ref.id);
    if (!file) throw new Error(`Pasted Pool file ${ref.id} was not found.`);
    return { kind: 'file', id: file.id, name: file.name, fileType: file.type };
  }
  const folder = session.data.folders.find((candidate) => candidate.id === ref.id);
  if (!folder) throw new Error(`Pasted Pool folder ${ref.id} was not found.`);
  return { kind: 'folder', id: folder.id, name: folder.name };
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
