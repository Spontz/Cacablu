import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

import { normalizePoolPath } from './asset-clipboard';

export const ASSET_FILE_DRAG_TYPE = 'application/x-cacablu-asset-file';

export function installPoolPathDrop(
  editor: monaco.editor.IStandaloneCodeEditor,
  element: HTMLElement,
): () => void {
  const handleDragOver = (event: DragEvent): void => {
    if (!isEditorEvent(event, element) || !hasPoolFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (event: DragEvent): void => {
    if (!isEditorEvent(event, element)) return;
    const path = getPoolFileDragPath(event.dataTransfer);
    if (!path) return;
    event.preventDefault();
    event.stopPropagation();

    const model = editor.getModel();
    const position = editor.getTargetAtClientPoint(event.clientX, event.clientY)?.position ?? editor.getPosition();
    if (!model || !position) return;

    const offset = model.getOffsetAt(position);
    editor.executeEdits('pool-path-drop', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text: path,
      forceMoveMarkers: true,
    }]);
    editor.setPosition(model.getPositionAt(offset + path.length));
    editor.focus();
  };

  // Capture at the document boundary before Monaco consumes external drops.
  document.addEventListener('dragover', handleDragOver, true);
  document.addEventListener('drop', handleDrop, true);
  return () => {
    document.removeEventListener('dragover', handleDragOver, true);
    document.removeEventListener('drop', handleDrop, true);
  };
}

function isEditorEvent(event: DragEvent, element: HTMLElement): boolean {
  return event.target instanceof Node && element.contains(event.target);
}

function hasPoolFileDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes(ASSET_FILE_DRAG_TYPE));
}

function getPoolFileDragPath(dataTransfer: DataTransfer | null): string | null {
  if (!hasPoolFileDrag(dataTransfer) || !dataTransfer) return null;
  const text = dataTransfer.getData('text/plain').trim();
  if (!text) return null;
  try {
    return normalizePoolPath(text);
  } catch {
    return null;
  }
}
