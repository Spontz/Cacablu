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
    expect(state.getSnapshot().timelinePasteLayer).toBeNull();
  });

  it('stores and validates the Timeline paste layer', () => {
    const state = createAppState();

    state.setTimelinePasteLayer(4);
    expect(state.getSnapshot().timelinePasteLayer).toBe(4);
    state.setTimelinePasteLayer(null);
    expect(state.getSnapshot().timelinePasteLayer).toBeNull();
    expect(() => state.setTimelinePasteLayer(-1)).toThrow(/non-negative integer/i);
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
    expect(state.getSnapshot().hasUnreadErrors).toBe(true);
    expect(state.getSnapshot().errorEventRevision).toBe(1);

    state.markEventsRead();

    expect(state.getSnapshot().unreadEventCount).toBe(0);
    expect(state.getSnapshot().hasUnreadErrors).toBe(false);
    expect(state.getSnapshot().errorEventRevision).toBe(1);
  });

  it('clears the unread error indicator when Events becomes active', () => {
    const state = createAppState();

    state.addEvent({ severity: 'error', description: 'Could not load section.' });
    state.setActivePanel('timeline');
    expect(state.getSnapshot().hasUnreadErrors).toBe(true);

    state.setActivePanel('events');
    expect(state.getSnapshot().hasUnreadErrors).toBe(false);
    expect(state.getSnapshot().events).toHaveLength(1);
  });

  it('keeps errors read when they arrive while Events is active', () => {
    const state = createAppState();

    state.setActivePanel('events');
    state.addEvent({ severity: 'error', description: 'Visible error.' });
    state.markSectionErrors([17]);

    expect(state.getSnapshot().hasUnreadErrors).toBe(false);
    expect(state.getSnapshot().unreadEventCount).toBe(0);
  });

  it('increments the error revision only for newly added errors', () => {
    const state = createAppState();

    state.addEvents([
      { severity: 'info', description: 'Connected.' },
      { severity: 'warning', description: 'Slow response.' },
    ]);
    expect(state.getSnapshot().errorEventRevision).toBe(0);

    state.addEvents([
      { severity: 'error', description: 'First error.' },
      { severity: 'error', description: 'Second error.' },
    ]);
    expect(state.getSnapshot().errorEventRevision).toBe(2);

    state.clearEvents();
    expect(state.getSnapshot().errorEventRevision).toBe(2);
  });

  it('tracks section error ids independently from events', () => {
    const state = createAppState();

    state.markSectionErrors([429, 433]);
    expect(state.getSnapshot().hasUnreadErrors).toBe(true);

    state.setActivePanel('events');
    state.clearSectionErrors([429]);

    expect(state.getSnapshot().sectionErrorIds).toEqual([433]);
    expect(state.getSnapshot().hasUnreadErrors).toBe(false);

    state.clearEvents();

    expect(state.getSnapshot().sectionErrorIds).toEqual([433]);

    state.resetSectionErrors();

    expect(state.getSnapshot().sectionErrorIds).toEqual([]);
  });

  it('stores and clears the selected runtime loop', () => {
    const state = createAppState();

    state.setActiveLoop({ startTime: 10, endTime: 20 });
    expect(state.getSnapshot().activeLoop).toEqual({ startTime: 10, endTime: 20 });

    state.setActiveLoop(null);
    expect(state.getSnapshot().activeLoop).toBeNull();
  });
});
