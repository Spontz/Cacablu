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
});
