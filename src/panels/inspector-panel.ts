import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { DbFile } from '../db/db-schema';
import { createContentRenderer } from './base-panel';
import { describeImagePreview } from './image-preview';
import { describeModelPreview } from './model-preview';
import type { PreviewableModelFormat } from './model-preview';
import { createModelViewer } from './model-viewer';
import type { ModelViewerSession } from './model-viewer';

export function createInspectorPanel(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--inspector';

    let previewUrl: string | null = null;
    let modelViewer: ModelViewerSession | null = null;
    let activeModelKey: string | null = null;

    function clearPreviewUrl(): void {
      if (!previewUrl) return;
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    function clearModelViewer(): void {
      modelViewer?.dispose();
      modelViewer = null;
      activeModelKey = null;
    }

    function createNote(text: string): HTMLParagraphElement {
      const note = document.createElement('p');
      note.className = 'panel-note inspector__note';
      note.textContent = text;
      return note;
    }

    function createMeta(label: string, value: string): HTMLElement {
      const row = document.createElement('p');
      row.className = 'inspector__meta';

      const labelEl = document.createElement('span');
      labelEl.className = 'inspector__meta-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'inspector__meta-value';
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      return row;
    }

    function findSelectedFile(id: number): DbFile | null {
      return sessionRef.current?.data.files.find((file) => file.id === id) ?? null;
    }

    function renderEmpty(message = 'Select an image file in Resources to preview it here.'): void {
      clearPreviewUrl();
      clearModelViewer();
      element.replaceChildren(createNote(message));
    }

    function renderFolder(name: string): void {
      clearPreviewUrl();
      clearModelViewer();
      element.replaceChildren(
        createMeta('Folder', name || '(unnamed folder)'),
        createNote('No preview is available for folders.'),
      );
    }

    function renderNonImageFile(file: DbFile): void {
      clearPreviewUrl();
      clearModelViewer();
      element.replaceChildren(
        createMeta('File', file.name || '(unnamed file)'),
        createMeta('Type', file.type || file.format || 'Unknown'),
        createMeta('Size', `${file.bytes || file.data.byteLength} bytes`),
        createNote('No preview is available for this file.'),
      );
    }

    function renderUnavailable(fileName: string, reason: string): void {
      clearPreviewUrl();
      clearModelViewer();
      element.replaceChildren(
        createMeta('File', fileName || '(unnamed file)'),
        createNote(reason),
      );
    }

    function renderImage(file: DbFile, mimeType: string): void {
      clearPreviewUrl();
      clearModelViewer();
      const imageBytes = new ArrayBuffer(file.data.byteLength);
      new Uint8Array(imageBytes).set(file.data);
      previewUrl = URL.createObjectURL(new Blob([imageBytes], { type: mimeType }));

      const image = document.createElement('img');
      image.className = 'inspector__image';
      image.alt = file.name || 'Selected image preview';
      image.src = previewUrl;
      image.addEventListener('error', () => {
        renderUnavailable(file.name, 'Preview unavailable for this image.');
      }, { once: true });

      const frame = document.createElement('div');
      frame.className = 'inspector__image-frame';
      frame.append(image);

      element.replaceChildren(
        createMeta('File', file.name || '(unnamed file)'),
        createMeta('Type', mimeType),
        createMeta('Size', `${file.bytes || file.data.byteLength} bytes`),
        frame,
      );
    }

    function renderModel(file: DbFile, format: PreviewableModelFormat): void {
      const modelKey = `${dbState.getSnapshot().fileName ?? ''}:${file.id}:${file.bytes}:${file.data.byteLength}:${format}`;
      if (modelViewer && activeModelKey === modelKey) return;

      clearPreviewUrl();
      clearModelViewer();
      activeModelKey = modelKey;

      const frame = document.createElement('div');
      frame.className = 'inspector__model-frame';
      frame.append(createNote('Loading 3D preview...'));
      const verticesMeta = createMeta('Vertices', 'Loading...');
      const verticesValue = verticesMeta.querySelector('.inspector__meta-value');

      element.replaceChildren(
        createMeta('File', file.name || '(unnamed file)'),
        createMeta('Size', `${file.bytes || file.data.byteLength} bytes`),
        verticesMeta,
        frame,
      );

      modelViewer = createModelViewer({
        container: frame,
        fileName: file.name,
        fileParent: file.parent,
        format,
        data: file.data,
        files: sessionRef.current?.data.files ?? [],
        onStats(stats) {
          if (verticesValue) verticesValue.textContent = stats.vertices.toLocaleString();
        },
        onError(message) {
          renderUnavailable(file.name, `3D preview unavailable: ${message}`);
        },
      });
    }

    function render(): void {
      if (dbState.getSnapshot().status !== 'open' || !sessionRef.current) {
        renderEmpty('No project open.');
        return;
      }

      const selection = state.getSnapshot().resourceSelection;
      if (selection.kind === 'none') {
        renderEmpty();
        return;
      }

      if (selection.kind === 'folder') {
        renderFolder(selection.name);
        return;
      }

      const file = findSelectedFile(selection.id);
      if (!file) {
        renderUnavailable(selection.name, 'Preview unavailable because the selected file is not in the current project.');
        return;
      }

      const descriptor = describeImagePreview(file);
      if (descriptor.isImageLike) {
        if (!descriptor.mimeType || descriptor.reason) {
          renderUnavailable(file.name, descriptor.reason ?? 'Preview unavailable for this image.');
          return;
        }

        renderImage(file, descriptor.mimeType);
        return;
      }

      const modelDescriptor = describeModelPreview(file);
      if (!modelDescriptor.isModelLike) {
        renderNonImageFile(file);
        return;
      }

      if (modelDescriptor.previewMode !== 'previewable' || !modelDescriptor.format) {
        renderUnavailable(file.name, modelDescriptor.reason ?? '3D preview unavailable for this model.');
        return;
      }

      renderModel(file, modelDescriptor.format as PreviewableModelFormat);
    }

    const unsubscribeState = state.subscribe(render);
    const unsubscribeDb = dbState.subscribe((snapshot) => {
      if (snapshot.status !== 'open') {
        clearPreviewUrl();
        clearModelViewer();
      }
      render();
    });

    return () => {
      unsubscribeState();
      unsubscribeDb();
      clearPreviewUrl();
      clearModelViewer();
    };
  });
}
