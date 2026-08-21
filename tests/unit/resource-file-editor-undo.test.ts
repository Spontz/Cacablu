import { describe, expect, it, vi } from 'vitest';

import { createUndoManager } from '../../src/app/undo-manager';
import type { DbSession, DbSessionRef } from '../../src/db/db-session';
import type { DbFile } from '../../src/db/db-schema';
import {
  registerResourceFileSaveUndo,
  shouldReplaceResourceFileEditorContent,
  snapshotResourceFileContent,
} from '../../src/services/resource-file-editor-undo';
import { createDbState } from '../../src/state/db-state';

function makeFile(content: string): DbFile {
  const data = new TextEncoder().encode(content);
  return {
    id: 9,
    name: 'camera.cam',
    parent: 0,
    bytes: data.byteLength,
    type: 'text/plain',
    data,
    format: 'cam',
    enabled: true,
  };
}

function makeSession(file: DbFile) {
  const updateResourceFileContent = vi.fn((fileId: number, input: Pick<DbFile, 'bytes' | 'type' | 'data' | 'format'>) => {
    if (fileId !== file.id) throw new Error('Unexpected file.');
    Object.assign(file, input);
    return file;
  });
  return {
    data: { files: [file] },
    updateResourceFileContent,
  } as unknown as DbSession & { updateResourceFileContent: typeof updateResourceFileContent };
}

describe('resource file editor undo', () => {
  it('only replaces the editor model when its file or persisted content changed', () => {
    expect(shouldReplaceResourceFileEditorContent(9, 9, 'same', 'same')).toBe(false);
    expect(shouldReplaceResourceFileEditorContent(9, 9, 'saved', 'saved')).toBe(false);
    expect(shouldReplaceResourceFileEditorContent(9, 9, 'before', 'after')).toBe(true);
    expect(shouldReplaceResourceFileEditorContent(8, 9, 'same', 'same')).toBe(true);
  });

  it('snapshots and restores exact bytes independently from later mutations', async () => {
    const file = makeFile('1\t2\r\n3  4');
    const previous = snapshotResourceFileContent(file);
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const onRestored = vi.fn();

    file.data[0] = 0;
    Object.assign(file, { data: new TextEncoder().encode('changed'), bytes: 7 });
    registerResourceFileSaveUndo({
      undoManager,
      dbState,
      sessionRef,
      session,
      fileId: file.id,
      fileName: file.name,
      previous,
      onRestored,
      onUnavailable: vi.fn(),
    });

    expect(await undoManager.undo()).toBe(true);
    expect(new TextDecoder().decode(file.data)).toBe('1\t2\r\n3  4');
    expect(file.bytes).toBe(previous.bytes);
    expect(dbState.getSnapshot().isDirty).toBe(true);
    expect(onRestored).toHaveBeenCalledWith(file);
  });

  it('does not mutate a stale project session', async () => {
    const file = makeFile('before');
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const undoManager = createUndoManager();

    registerResourceFileSaveUndo({
      undoManager,
      dbState: createDbState(),
      sessionRef,
      session,
      fileId: file.id,
      fileName: file.name,
      previous: snapshotResourceFileContent(file),
      onRestored: vi.fn(),
      onUnavailable: vi.fn(),
    });
    sessionRef.current = makeSession(makeFile('replacement'));

    await undoManager.undo();
    expect(session.updateResourceFileContent).not.toHaveBeenCalled();
  });

  it('reports a removed target without overwriting another asset', async () => {
    const file = makeFile('before');
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const undoManager = createUndoManager();
    const onUnavailable = vi.fn();

    registerResourceFileSaveUndo({
      undoManager,
      dbState: createDbState(),
      sessionRef,
      session,
      fileId: file.id,
      fileName: file.name,
      previous: snapshotResourceFileContent(file),
      onRestored: vi.fn(),
      onUnavailable,
    });
    session.data.files.length = 0;

    await undoManager.undo();
    expect(session.updateResourceFileContent).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });
});
