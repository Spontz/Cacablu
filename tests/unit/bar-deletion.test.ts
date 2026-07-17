import { describe, expect, it, vi } from 'vitest';

import type { ResourceSelection } from '../../src/app/types';
import type { DbBar, ProjectDatabase } from '../../src/db/db-schema';
import type { PhoenixSectionSyncResult } from '../../src/phoenix/section-client';
import {
  deleteSelectedTimelineBars,
  isBarDeletionEditingTarget,
  isBarDeletionShortcut,
  restoreDeletedTimelineBars,
  syncDeletedTimelineBarsToPhoenix,
  syncRestoredTimelineBarsToPhoenix,
} from '../../src/services/bar-deletion';

function makeBar(id: number, overrides: Partial<DbBar> = {}): DbBar {
  return {
    id,
    name: `bar-${id}`,
    type: 'drawImage',
    layer: id,
    startTime: id * 2,
    endTime: id * 2 + 1,
    enabled: true,
    selected: false,
    script: `image /pool/${id}.png`,
    srcBlending: 'SRC_ALPHA',
    dstBlending: 'ONE_MINUS_SRC_ALPHA',
    blendingEQ: 'ADD',
    srcAlpha: 'ONE',
    dstAlpha: 'ZERO',
    ...overrides,
  };
}

function makeSession(bars: DbBar[]) {
  const data: Pick<ProjectDatabase, 'bars'> = { bars };
  return {
    data,
    deleteTimelineBars: vi.fn((ids: number[]) => {
      const idSet = new Set(ids);
      const deleted = data.bars.filter((bar) => idSet.has(bar.id)).map((bar) => ({ ...bar }));
      data.bars.splice(0, data.bars.length, ...data.bars.filter((bar) => !idSet.has(bar.id)));
      return deleted;
    }),
    restoreTimelineBars: vi.fn((restored: DbBar[]) => {
      data.bars.push(...restored.map((bar) => ({ ...bar })));
      return restored;
    }),
  };
}

function shortcut(key: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  } as KeyboardEvent;
}

function makeSyncResult(operation: PhoenixSectionSyncResult['operation']): PhoenixSectionSyncResult {
  return {
    requestId: 'test-request',
    ok: true,
    operation,
    received: 1,
    loaded: operation === 'update-one' ? 1 : 0,
    failed: 0,
    writtenFiles: operation === 'update-one' ? 1 : 0,
    deletedFiles: operation === 'delete-many' ? ['5.spo'] : [],
    failedSections: [],
  };
}

describe('selected timeline bar deletion', () => {
  it('accepts Delete and Backspace without command modifiers', () => {
    expect(isBarDeletionShortcut(shortcut('Delete'))).toBe(true);
    expect(isBarDeletionShortcut(shortcut('Backspace'))).toBe(true);
    expect(isBarDeletionShortcut(shortcut('Backspace', { ctrlKey: true }))).toBe(false);
    expect(isBarDeletionShortcut(shortcut('x'))).toBe(false);
  });

  it.each([
    'input',
    'textarea',
    'select',
    '[contenteditable]',
    '[role="textbox"]',
    '.monaco-editor',
  ])('preserves editing behavior for a target matching %s', (matchedSelector) => {
    const target = {
      closest: vi.fn((selector: string) => selector.includes(matchedSelector) ? {} : null),
    } as unknown as EventTarget;

    expect(isBarDeletionEditingTarget(target)).toBe(true);
  });

  it('does not classify a non-editable target as text editing', () => {
    const target = { closest: vi.fn(() => null) } as unknown as EventTarget;
    expect(isBarDeletionEditingTarget(target)).toBe(false);
    expect(isBarDeletionEditingTarget(null)).toBe(false);
  });

  it('filters stale ids and deletes a multi-selection in deterministic bar order', () => {
    const first = makeBar(1);
    const second = makeBar(2);
    const unrelated = makeBar(3);
    const session = makeSession([second, unrelated, first]);
    const selection: ResourceSelection = { kind: 'bars', ids: [2, 99, 1] };

    const result = deleteSelectedTimelineBars(session, selection);

    expect(result.deletedIds).toEqual([1, 2]);
    expect(result.deletedBars).toEqual([first, second]);
    expect(session.deleteTimelineBars).toHaveBeenCalledWith([1, 2]);
    expect(session.data.bars).toEqual([unrelated]);
  });

  it('does nothing for no selection or a stale single selection', () => {
    const session = makeSession([makeBar(1)]);

    expect(deleteSelectedTimelineBars(session, { kind: 'none' })).toEqual({
      deletedBars: [],
      deletedIds: [],
    });
    expect(deleteSelectedTimelineBars(session, { kind: 'bar', id: 99 })).toEqual({
      deletedBars: [],
      deletedIds: [],
    });
    expect(session.deleteTimelineBars).not.toHaveBeenCalled();
  });

  it('restores immutable complete snapshots through the session transaction API', () => {
    const original = makeBar(7, { enabled: false, selected: true, blendingEQ: 'MAX' });
    const session = makeSession([]);
    const snapshot = { ...original };

    restoreDeletedTimelineBars(session, [snapshot]);
    snapshot.script = 'mutated after restore';

    expect(session.restoreTimelineBars).toHaveBeenCalledWith([original]);
    expect(session.data.bars).toEqual([original]);
  });

  it('deletes all ids in one Phoenix request and skips the request while disconnected', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ failedSections: [] });

    await expect(syncDeletedTimelineBarsToPhoenix(
      [1, 2],
      { isConnected: () => true },
      { deleteMany },
    )).resolves.toEqual([1, 2]);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith(['1', '2']);

    deleteMany.mockClear();
    await expect(syncDeletedTimelineBarsToPhoenix(
      [1, 2],
      { isConnected: () => false },
      { deleteMany },
    )).resolves.toEqual([]);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('republishes only restored bars eligible for Phoenix publication', async () => {
    const replaceOne = vi.fn().mockResolvedValue({ failedSections: [] });
    const db = {
      bars: [
        makeBar(1),
        makeBar(2, { enabled: false }),
      ],
    };

    const result = await syncRestoredTimelineBarsToPhoenix(
      db,
      [1, 2],
      { isConnected: () => true },
      { replaceOne },
    );

    expect(replaceOne).toHaveBeenCalledTimes(1);
    expect(replaceOne).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), undefined);
    expect(result).toEqual({ issues: [], restoredIds: [1] });
  });

  it('skips restoration requests while disconnected and propagates connected transport failures', async () => {
    const replaceOne = vi.fn();
    const db = { bars: [makeBar(1)] };

    await expect(syncRestoredTimelineBarsToPhoenix(
      db,
      [1],
      { isConnected: () => false },
      { replaceOne },
    )).resolves.toEqual({ issues: [], restoredIds: [] });
    expect(replaceOne).not.toHaveBeenCalled();

    replaceOne.mockRejectedValueOnce(new Error('Phoenix unavailable'));
    await expect(syncRestoredTimelineBarsToPhoenix(
      db,
      [1],
      { isConnected: () => true },
      { replaceOne },
    )).rejects.toThrow('Phoenix unavailable');
  });

  it.each(['Delete', 'Backspace'])(
    'runs connected %s deletion and undo restoration in Phoenix order',
    async (key) => {
      expect(isBarDeletionShortcut(shortcut(key))).toBe(true);
      const original = makeBar(5);
      const session = makeSession([original]);
      const calls: string[] = [];
      let finishDelete = (): void => {};
      const deleteMany = vi.fn(() => new Promise<PhoenixSectionSyncResult>((resolve) => {
        calls.push('delete-start');
        finishDelete = () => {
          calls.push('delete-complete');
          resolve(makeSyncResult('delete-many'));
        };
      }));
      const replaceOne = vi.fn(async (): Promise<PhoenixSectionSyncResult> => {
        calls.push('restore');
        return makeSyncResult('update-one');
      });
      const connection = { isConnected: () => true };

      const deleted = deleteSelectedTimelineBars(session, { kind: 'bar', id: original.id });
      const pendingDelete = syncDeletedTimelineBarsToPhoenix(deleted.deletedIds, connection, { deleteMany });
      restoreDeletedTimelineBars(session, deleted.deletedBars);
      finishDelete();
      await pendingDelete;
      await syncRestoredTimelineBarsToPhoenix(session.data, deleted.deletedIds, connection, { replaceOne });

      expect(session.data.bars).toEqual([original]);
      expect(calls).toEqual(['delete-start', 'delete-complete', 'restore']);
    },
  );
});
