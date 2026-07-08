import { describe, expect, it, vi } from 'vitest';
import { createDefaultMenuActions } from '../../src/menu/menu-actions';
import type { ResourceSelection } from '../../src/app/types';
import type { DbBar, ProjectDatabase } from '../../src/db/db-schema';
import {
  getSelectedExistingBars,
  hasSelectedExistingBars,
  restoreBarEnabledStates,
  syncBarEnabledChangesToPhoenix,
  toggleSelectedBarEnabledStates,
} from '../../src/services/bar-enable-toggle';

function makeBar(id: number, enabled: boolean): DbBar {
  return {
    id,
    name: `bar-${id}`,
    type: 'drawImage',
    layer: 1,
    startTime: id,
    endTime: id + 1,
    enabled,
    selected: false,
    script: '',
    srcBlending: 'ONE',
    dstBlending: 'ZERO',
    blendingEQ: 'ADD',
    srcAlpha: '',
    dstAlpha: '',
  };
}

function makeSession(bars: DbBar[]) {
  const db: Pick<ProjectDatabase, 'bars'> = { bars };
  const setTimelineBarEnabled = vi.fn((barId: number, enabled: boolean) => {
    const bar = db.bars.find((candidate) => candidate.id === barId);
    if (!bar) throw new Error(`Timeline bar ${barId} was not found.`);
    bar.enabled = enabled;
    return bar;
  });

  return {
    data: db,
    setTimelineBarEnabled,
  };
}

describe('bar enable toggle', () => {
  it('defines the Bars menu action with Ctrl+D', () => {
    const action = createDefaultMenuActions().find((candidate) => candidate.id === 'toggle-enable-bars');

    expect(action).toMatchObject({
      label: 'Toggle Enable',
      menu: 'Bars',
      shortcut: { default: 'Ctrl+D' },
    });
  });

  it('detects whether the current selection contains existing bars', () => {
    const db = { bars: [makeBar(1, true)] };

    expect(hasSelectedExistingBars(db, { kind: 'none' })).toBe(false);
    expect(hasSelectedExistingBars(db, { kind: 'bar', id: 1 })).toBe(true);
    expect(hasSelectedExistingBars(db, { kind: 'bar', id: 2 })).toBe(false);
    expect(hasSelectedExistingBars(db, { kind: 'bars', ids: [2, 1] })).toBe(true);
  });

  it('toggles one enabled bar to disabled', () => {
    const session = makeSession([makeBar(1, true)]);
    const result = toggleSelectedBarEnabledStates(session, { kind: 'bar', id: 1 });

    expect(session.data.bars[0].enabled).toBe(false);
    expect(result).toEqual({
      changed: [{ id: 1, enabled: true }],
      enabledIds: [],
      disabledIds: [1],
    });
  });

  it('toggles one disabled bar to enabled', () => {
    const session = makeSession([makeBar(1, false)]);
    const result = toggleSelectedBarEnabledStates(session, { kind: 'bar', id: 1 });

    expect(session.data.bars[0].enabled).toBe(true);
    expect(result.enabledIds).toEqual([1]);
    expect(result.disabledIds).toEqual([]);
  });

  it('inverts mixed multi-selection per bar and keeps deterministic id order', () => {
    const session = makeSession([makeBar(3, true), makeBar(1, false), makeBar(2, true)]);
    const selection: ResourceSelection = { kind: 'bars', ids: [3, 1, 99, 2] };
    const result = toggleSelectedBarEnabledStates(session, selection);

    expect(getSelectedExistingBars(session.data, selection).map((bar) => bar.id)).toEqual([1, 2, 3]);
    expect(session.data.bars.map((bar) => [bar.id, bar.enabled])).toEqual([
      [3, false],
      [1, true],
      [2, false],
    ]);
    expect(result.changed).toEqual([
      { id: 1, enabled: false },
      { id: 2, enabled: true },
      { id: 3, enabled: true },
    ]);
    expect(result.enabledIds).toEqual([1]);
    expect(result.disabledIds).toEqual([2, 3]);
  });

  it('restores enabled values for undo', () => {
    const session = makeSession([makeBar(1, false), makeBar(2, true)]);
    const result = restoreBarEnabledStates(session, [
      { id: 1, enabled: true },
      { id: 2, enabled: false },
    ]);

    expect(session.data.bars.map((bar) => [bar.id, bar.enabled])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(result.enabledIds).toEqual([1]);
    expect(result.disabledIds).toEqual([2]);
  });

  it('deletes disabled bars and updates enabled bars when Phoenix is connected', async () => {
    const db = { bars: [makeBar(1, true), makeBar(2, true)] };
    const deleteMany = vi.fn().mockResolvedValue({ failedSections: [] });
    const replaceOne = vi.fn().mockResolvedValue({ failedSections: [] });

    await syncBarEnabledChangesToPhoenix(
      db,
      { enabledIds: [1], disabledIds: [2] },
      { isConnected: () => true },
      { deleteMany, replaceOne },
    );

    expect(deleteMany).toHaveBeenCalledWith(['2']);
    expect(replaceOne).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), undefined);
  });

  it('skips Phoenix requests when disconnected', async () => {
    const deleteMany = vi.fn();
    const replaceOne = vi.fn();

    const result = await syncBarEnabledChangesToPhoenix(
      { bars: [makeBar(1, true), makeBar(2, false)] },
      { enabledIds: [1], disabledIds: [2] },
      { isConnected: () => false },
      { deleteMany, replaceOne },
    );

    expect(result).toEqual({ issues: [], deletedIds: [], enabledIds: [] });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(replaceOne).not.toHaveBeenCalled();
  });
});
