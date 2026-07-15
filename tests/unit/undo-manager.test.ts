import { describe, expect, it } from 'vitest';

import { createUndoManager } from '../../src/app/undo-manager';

describe('UndoManager', () => {
  it('retains a command when its inverse rejects a later conflict', async () => {
    const manager = createUndoManager();
    let conflicted = true;
    let undoCount = 0;
    manager.push({
      label: 'Pool mutation',
      undo: () => {
        if (conflicted) throw new Error('destination conflict');
        undoCount += 1;
      },
    });

    await expect(manager.undo()).rejects.toThrow('destination conflict');
    expect(manager.canUndo()).toBe(true);
    conflicted = false;
    await expect(manager.undo()).resolves.toBe(true);
    expect(undoCount).toBe(1);
    expect(manager.canUndo()).toBe(false);
  });
});
