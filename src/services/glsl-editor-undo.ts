import type { UndoManager } from '../app/undo-manager';
import type { DbSession, DbSessionRef } from '../db/db-session';
import type { DbFile } from '../db/db-schema';
import type { DbState } from '../state/db-state';

export type ResourceFileContentSnapshot = Pick<DbFile, 'bytes' | 'type' | 'data' | 'format'>;

interface RegisterGlslSaveUndoOptions {
  undoManager: UndoManager;
  dbState: DbState;
  sessionRef: DbSessionRef;
  session: DbSession;
  fileId: number;
  fileName: string;
  previous: ResourceFileContentSnapshot;
  onRestored(file: DbFile): void | Promise<void>;
  onUnavailable(message: string): void;
}

export function snapshotResourceFileContent(file: DbFile): ResourceFileContentSnapshot {
  return {
    bytes: file.bytes,
    type: file.type,
    data: file.data.slice(),
    format: file.format,
  };
}

export function shouldReplaceGlslEditorContent(
  currentFileId: number | null,
  nextFileId: number,
  editorContent: string,
  persistedContent: string,
): boolean {
  return currentFileId !== nextFileId || editorContent !== persistedContent;
}

export function registerGlslSaveUndo(options: RegisterGlslSaveUndoOptions): void {
  const previous = {
    ...options.previous,
    data: options.previous.data.slice(),
  };

  options.undoManager.push({
    label: `Edit ${options.fileName}`,
    undo: async () => {
      if (options.sessionRef.current !== options.session) return;

      const file = options.session.data.files.find((candidate) => candidate.id === options.fileId);
      if (!file) {
        options.onUnavailable(`${options.fileName} is no longer available, so its saved edit could not be undone.`);
        return;
      }

      const restored = options.session.updateResourceFileContent(options.fileId, {
        ...previous,
        data: previous.data.slice(),
      });
      options.dbState.setDirty();
      await options.onRestored(restored);
    },
  });
}
