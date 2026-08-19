import type { IContentRenderer } from 'dockview-core';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/min/vs/editor/editor.main.css';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ConnectionController } from '../ws/connection';
import type { UndoManager } from '../app/undo-manager';
import { buildResourceTree, type ResourceTreeNode } from '../resources/resource-tree';
import { createPhoenixAssetClient } from '../phoenix/asset-client';
import { runAssetOperationWithEvents } from '../phoenix/asset-impact-events';
import { createPhoenixLogClient } from '../phoenix/log-client';
import { writeAllowedAssetFile } from '../phoenix/asset-operations';
import {
  registerResourceFileSaveUndo,
  shouldReplaceResourceFileEditorContent,
  snapshotResourceFileContent,
} from '../services/resource-file-editor-undo';
import { getCamPhoenixSaveAction, isCamAssetName } from '../services/cam-asset-save';
import { createContentRenderer } from './base-panel';
import { CACABLU_CODE_THEME, registerCacabluCodeTheme } from './code-editor-theme';
import { installSelectionOccurrenceHighlighting } from './selection-occurrence-highlighting';
import { camColumnClassName, findCamColumnTokens } from './cam-column-highlighting';

const CAM_LANGUAGE_ID = 'cacablu-cam';

registerCamLanguage();
registerCacabluCodeTheme();

export function createCamAssetEditorPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
  undoManager: UndoManager,
): IContentRenderer {
  return createContentRenderer((element, params) => {
    element.className = 'panel panel--glsl-editor panel--cam-editor';

    const phoenixAssets = createPhoenixAssetClient();
    const phoenixLogs = createPhoenixLogClient();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const fixedFileId = getPanelFileId(params);
    let editor: monaco.editor.IStandaloneCodeEditor | null = null;
    let decorations: monaco.editor.IEditorDecorationsCollection | null = null;
    let currentFileId: number | null = null;
    let originalContent = '';
    let currentPath = '';
    let saveInFlight = false;
    let suppressNextDbReload = false;

    const header = document.createElement('div');
    header.className = 'glsl-editor__header';

    const title = document.createElement('div');
    title.className = 'glsl-editor__title';

    const code = document.createElement('div');
    code.className = 'glsl-editor__code';

    const actions = document.createElement('div');
    actions.className = 'glsl-editor__actions';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'glsl-editor__button glsl-editor__button--primary';
    save.textContent = 'Guardar';

    header.append(title);
    actions.append(save);
    element.append(header, code, actions);

    editor = monaco.editor.create(code, {
      value: '',
      language: CAM_LANGUAGE_ID,
      theme: CACABLU_CODE_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: 11,
      lineHeight: 18,
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 4,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      padding: { top: 8, bottom: 8 },
      scrollBeyondLastLine: false,
    });
    decorations = editor.createDecorationsCollection();
    const disposeSelectionOccurrenceHighlighting = installSelectionOccurrenceHighlighting(editor);
    monaco.editor.setTheme(CACABLU_CODE_THEME);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      void editor?.getModel()?.undo();
    });
    editor.onDidChangeModelContent(() => {
      refreshColumnDecorations();
      syncSaveDisabled();
    });

    const loadCurrentSelection = (): void => {
      const session = sessionRef.current;
      if (!session) {
        setEmpty('Select a CAM asset.');
        return;
      }

      const selection = state.getSnapshot().assetSelection;
      const targetFileId = fixedFileId ?? (selection.kind === 'file' ? selection.id : null);
      if (targetFileId === null) {
        setEmpty('Select a CAM asset.');
        return;
      }

      const file = session.data.files.find((candidate) => candidate.id === targetFileId);
      if (!file || !isCamAssetName(file.name)) {
        setEmpty('Select a CAM asset.');
        return;
      }

      const path = findAssetPath(session.data, file.id);
      if (!path) {
        setEmpty('Could not resolve asset path.');
        return;
      }

      const persistedContent = decoder.decode(new Uint8Array(file.data));
      const replaceEditorContent = shouldReplaceResourceFileEditorContent(
        currentFileId,
        file.id,
        editor?.getValue() ?? '',
        persistedContent,
      );
      currentFileId = file.id;
      currentPath = `pool/${path}`;
      originalContent = persistedContent;
      title.textContent = currentPath;
      if (replaceEditorContent) editor?.setValue(originalContent);
      refreshColumnDecorations();
      syncSaveDisabled();
    };

    const unsubscribeState = state.subscribe(() => {
      if (fixedFileId !== null) return;
      const selection = state.getSnapshot().assetSelection;
      const nextId = selection.kind === 'file' ? selection.id : null;
      if (nextId !== currentFileId) loadCurrentSelection();
    });
    const unsubscribeDb = dbState.subscribe(() => {
      if (suppressNextDbReload) {
        suppressNextDbReload = false;
        syncSaveDisabled();
        return;
      }
      loadCurrentSelection();
    });

    save.addEventListener('click', async () => {
      const session = sessionRef.current;
      if (!editor || !session || currentFileId === null || saveInFlight) return;

      const file = session.data.files.find((candidate) => candidate.id === currentFileId);
      if (!file || !isCamAssetName(file.name)) {
        state.addEvent({ severity: 'warning', source: 'CAM editor', description: 'The CAM asset is no longer available.' });
        loadCurrentSelection();
        return;
      }
      const path = findAssetPath(session.data, file.id);
      if (!path) {
        state.addEvent({ severity: 'warning', source: 'CAM editor', description: `Could not resolve the current path for ${file.name}.` });
        loadCurrentSelection();
        return;
      }

      const poolPath = `pool/${path}`;
      const content = editor.getValue();
      const bytes = encoder.encode(content);
      const previous = snapshotResourceFileContent(file);
      saveInFlight = true;
      syncSaveDisabled();

      try {
        session.updateResourceFileContent(currentFileId, {
          bytes: bytes.byteLength,
          type: 'text/plain',
          data: bytes,
          format: 'cam',
        });
        currentPath = poolPath;
        originalContent = content;
        suppressNextDbReload = true;
        dbState.setDirty();
        registerResourceFileSaveUndo({
          undoManager,
          dbState,
          sessionRef,
          session,
          fileId: currentFileId,
          fileName: file.name,
          previous,
          onUnavailable: (message) => {
            state.addEvent({ severity: 'warning', source: 'CAM editor', description: message });
          },
          onRestored: async (restoredFile) => {
            const phoenixAction = getCamPhoenixSaveAction(restoredFile.enabled, connection.isConnected());
            if (phoenixAction === 'local-only') return;
            const activeSession = sessionRef.current;
            const restoredPath = activeSession ? findAssetPath(activeSession.data, restoredFile.id) : null;
            if (!restoredPath) {
              state.addEvent({ severity: 'warning', source: 'CAM editor', description: `Could not resolve the restored path for ${restoredFile.name}.` });
              return;
            }
            if (phoenixAction === 'warn-offline') {
              state.addEvent({ severity: 'warning', source: 'CAM editor', description: `Restored ${restoredFile.name} in the project DB, but Phoenix is not connected so its disk copy was not updated.` });
              return;
            }
            try {
              await syncWithPhoenix(`Restored ${restoredFile.name}`, `pool/${restoredPath}`, new Uint8Array(restoredFile.data));
            } catch (error) {
              state.addEvent({ severity: 'error', source: 'CAM editor', description: error instanceof Error ? error.message : `Could not restore ${restoredFile.name} in Phoenix.` });
            }
          },
        });

        const phoenixAction = getCamPhoenixSaveAction(file.enabled, connection.isConnected());
        if (phoenixAction === 'sync') {
          await syncWithPhoenix(`Saved ${file.name}`, poolPath, bytes);
        } else if (phoenixAction === 'warn-offline') {
          state.addEvent({ severity: 'warning', source: 'CAM editor', description: `Saved ${file.name} in the project DB, but Phoenix is not connected so its disk copy was not updated.` });
        }
      } catch (error) {
        state.addEvent({ severity: 'error', source: 'CAM editor', description: error instanceof Error ? error.message : 'Could not save CAM asset.' });
      } finally {
        saveInFlight = false;
        syncSaveDisabled();
      }
    });

    loadCurrentSelection();

    return () => {
      unsubscribeState();
      unsubscribeDb();
      disposeSelectionOccurrenceHighlighting();
      decorations?.clear();
      decorations = null;
      editor?.dispose();
      editor = null;
    };

    async function syncWithPhoenix(context: string, path: string, bytes: Uint8Array): Promise<void> {
      await runAssetOperationWithEvents(
        state,
        phoenixLogs,
        context,
        () => writeAllowedAssetFile(phoenixAssets, path, bytes),
      );
    }

    function refreshColumnDecorations(): void {
      if (!editor || !decorations) return;
      decorations.set(findCamColumnTokens(editor.getValue()).map((token) => ({
        range: new monaco.Range(token.lineNumber, token.startColumn, token.lineNumber, token.endColumn),
        options: { inlineClassName: camColumnClassName(token.columnIndex) },
      })));
    }

    function setEmpty(message: string): void {
      currentFileId = null;
      currentPath = '';
      originalContent = '';
      title.textContent = message;
      editor?.setValue('');
      refreshColumnDecorations();
      syncSaveDisabled();
    }

    function syncSaveDisabled(): void {
      save.disabled = saveInFlight || !currentPath || !editor || editor.getValue() === originalContent;
    }
  });
}

function registerCamLanguage(): void {
  if (monaco.languages.getLanguages().some((language) => language.id === CAM_LANGUAGE_ID)) return;
  monaco.languages.register({
    id: CAM_LANGUAGE_ID,
    extensions: ['.cam'],
    aliases: ['CAM', 'cam'],
    mimetypes: ['text/plain'],
  });
}

function getPanelFileId(params: { params?: unknown }): number | null {
  const rawParams = params.params;
  if (!rawParams || typeof rawParams !== 'object') return null;
  const fileId = (rawParams as Record<string, unknown>).fileId;
  return typeof fileId === 'number' && Number.isFinite(fileId) ? fileId : null;
}

function findAssetPath(db: Parameters<typeof buildResourceTree>[0], fileId: number): string | null {
  const roots = buildResourceTree(db);
  const visit = (node: ResourceTreeNode): string | null => {
    if (node.kind === 'file' && node.id === fileId) return node.path;
    if (node.kind === 'folder') {
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };

  for (const root of roots) {
    const found = visit(root);
    if (found) return found;
  }
  return null;
}
