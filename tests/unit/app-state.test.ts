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

  it('does not notify subscribers when connection status is unchanged', () => {
    const state = createAppState();
    let updates = 0;
    state.subscribe(() => {
      updates += 1;
    });

    state.setConnection('connected', 'Phoenix connected');
    state.setConnection('connected', 'Phoenix connected');

    expect(updates).toBe(2);
  });

  it('starts with no resource selection', () => {
    const state = createAppState();

    expect(state.getSnapshot().resourceSelection).toEqual({ kind: 'none' });
    expect(state.getSnapshot().assetSelection).toEqual({ kind: 'none' });
  });

  it('updates and clears file asset selection', () => {
    const state = createAppState();

    state.setAssetSelection({
      kind: 'file',
      id: 7,
      name: 'hero.png',
      fileType: 'image/png',
    });

    expect(state.getSnapshot().assetSelection).toEqual({
      kind: 'file',
      id: 7,
      name: 'hero.png',
      fileType: 'image/png',
    });
    expect(state.getSnapshot().resourceSelection).toEqual({ kind: 'none' });

    state.clearAssetSelection();

    expect(state.getSnapshot().assetSelection).toEqual({ kind: 'none' });
  });

  it('keeps asset selections isolated per state instance', () => {
    const first = createAppState();
    const second = createAppState();

    first.setAssetSelection({ kind: 'folder', id: 3, name: 'Images' });

    expect(first.getSnapshot().assetSelection).toEqual({
      kind: 'folder',
      id: 3,
      name: 'Images',
    });
    expect(second.getSnapshot().assetSelection).toEqual({ kind: 'none' });
  });

  it('records application events', () => {
    const state = createAppState();

    state.addEvents([
      {
        severity: 'error',
        source: 'Phoenix section sync',
        subjectId: '17',
        description: 'Bar 17 was not sent.',
      },
    ]);

    expect(state.getSnapshot().events).toHaveLength(1);
    expect(state.getSnapshot().events[0]).toMatchObject({
      severity: 'error',
      source: 'Phoenix section sync',
      subjectId: '17',
      description: 'Bar 17 was not sent.',
    });
    expect(state.getSnapshot().unreadEventCount).toBe(1);

    state.markEventsRead();

    expect(state.getSnapshot().unreadEventCount).toBe(0);
  });

  it('tracks section error ids independently from events', () => {
    const state = createAppState();

    state.markSectionErrors([429, 433]);
    state.clearSectionErrors([429]);

    expect(state.getSnapshot().sectionErrorIds).toEqual([433]);

    state.clearEvents();

    expect(state.getSnapshot().sectionErrorIds).toEqual([433]);

    state.resetSectionErrors();

    expect(state.getSnapshot().sectionErrorIds).toEqual([]);
  });
});
