import { describe, expect, it, vi } from 'vitest';

import { createUndoManager } from '../../src/app/undo-manager';
import type { DbSession, DbSessionRef } from '../../src/db/db-session';
import type { DbFile } from '../../src/db/db-schema';
import {
  registerGlslSaveUndo,
  shouldReplaceGlslEditorContent,
  snapshotResourceFileContent,
} from '../../src/services/glsl-editor-undo';
import { createDbState } from '../../src/state/db-state';

function makeFile(content: string): DbFile {
  const data = new TextEncoder().encode(content);
  return {
    id: 7,
    name: 'effect.glsl',
    parent: 0,
    bytes: data.byteLength,
    type: 'text/plain',
    data,
    format: 'glsl',
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

describe('GLSL editor undo', () => {
  it('preserves Monaco text history when saving the unchanged editor model', () => {
    expect(shouldReplaceGlslEditorContent(7, 7, 'saved text', 'saved text')).toBe(false);
    expect(shouldReplaceGlslEditorContent(7, 7, 'unsaved text', 'saved text')).toBe(true);
    expect(shouldReplaceGlslEditorContent(6, 7, 'saved text', 'saved text')).toBe(true);
  });

  it('captures file bytes independently from later mutations', () => {
    const file = makeFile('before');
    const snapshot = snapshotResourceFileContent(file);

    file.data[0] = 0;

    expect(new TextDecoder().decode(snapshot.data)).toBe('before');
  });

  it('restores the exact persisted predecessor and marks the project dirty', async () => {
    const file = makeFile('before');
    const previous = snapshotResourceFileContent(file);
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const undoManager = createUndoManager();
    const dbState = createDbState();
    const onRestored = vi.fn();

    Object.assign(file, { data: new TextEncoder().encode('after'), bytes: 5 });
    registerGlslSaveUndo({
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

    expect(undoManager.canUndo()).toBe(true);
    expect(await undoManager.undo()).toBe(true);
    expect(new TextDecoder().decode(file.data)).toBe('before');
    expect(file.bytes).toBe(6);
    expect(dbState.getSnapshot().isDirty).toBe(true);
    expect(onRestored).toHaveBeenCalledWith(file);
    expect(session.updateResourceFileContent).toHaveBeenCalledTimes(1);
  });

  it('does not mutate a replacement project session', async () => {
    const file = makeFile('before');
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const undoManager = createUndoManager();

    registerGlslSaveUndo({
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
    sessionRef.current = makeSession(makeFile('other'));

    await undoManager.undo();

    expect(session.updateResourceFileContent).not.toHaveBeenCalled();
  });

  it('reports a removed file without attempting a restore', async () => {
    const file = makeFile('before');
    const session = makeSession(file);
    const sessionRef: DbSessionRef = { current: session };
    const undoManager = createUndoManager();
    const onUnavailable = vi.fn();

    registerGlslSaveUndo({
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
