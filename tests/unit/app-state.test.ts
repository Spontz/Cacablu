import { describe, expect, it } from 'vitest';

import { createAppState } from '../../src/state/app-state';

describe('createAppState', () => {
  it('updates the active panel', () => {
    const state = createAppState();

    state.setActivePanel('timeline');

    expect(state.getSnapshot().activePanelId).toBe('timeline');
  });

  it('updates connection status and last error', () => {
    const state = createAppState();

    state.setConnection('error', 'Engine connection error', 'Socket refused');

    expect(state.getSnapshot()).toMatchObject({
      connectionStatus: 'error',
      connectionLabel: 'Engine connection error',
      lastError: 'Socket refused',
    });
  });

  it('starts with no resource selection', () => {
    const state = createAppState();

    expect(state.getSnapshot().resourceSelection).toEqual({ kind: 'none' });
  });

  it('updates and clears file resource selection', () => {
    const state = createAppState();

    state.setResourceSelection({
      kind: 'file',
      id: 7,
      name: 'hero.png',
      fileType: 'image/png',
    });

    expect(state.getSnapshot().resourceSelection).toEqual({
      kind: 'file',
      id: 7,
      name: 'hero.png',
      fileType: 'image/png',
    });

    state.clearResourceSelection();

    expect(state.getSnapshot().resourceSelection).toEqual({ kind: 'none' });
  });

  it('keeps resource selections isolated per state instance', () => {
    const first = createAppState();
    const second = createAppState();

    first.setResourceSelection({ kind: 'folder', id: 3, name: 'Images' });

    expect(first.getSnapshot().resourceSelection).toEqual({
      kind: 'folder',
      id: 3,
      name: 'Images',
    });
    expect(second.getSnapshot().resourceSelection).toEqual({ kind: 'none' });
  });
});
