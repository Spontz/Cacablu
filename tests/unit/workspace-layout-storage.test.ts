import { describe, expect, it, vi } from 'vitest';
import type { SerializedDockview } from 'dockview-core';

import {
  WORKSPACE_LAYOUT_STORAGE_KEY,
  readWorkspaceLayout,
  removeWorkspaceLayout,
  writeWorkspaceLayout,
  type WorkspaceLayoutStorage,
} from '../../src/layout/workspace-layout-storage';

const layout = {
  grid: {
    root: {},
    height: 720,
    width: 1280,
    orientation: 'HORIZONTAL',
  },
  panels: {
    timeline: {
      id: 'timeline',
      contentComponent: 'timeline-panel',
      title: 'Timeline',
    },
  },
  activeGroup: '1',
} as unknown as SerializedDockview;

function createMemoryStorage(): WorkspaceLayoutStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('workspace layout storage', () => {
  it('round-trips a versioned Dockview layout', () => {
    const storage = createMemoryStorage();

    expect(writeWorkspaceLayout(storage, layout)).toBe(true);
    expect(readWorkspaceLayout(storage)).toEqual({ kind: 'restored', layout });
  });

  it('distinguishes a missing preference from a saved layout', () => {
    expect(readWorkspaceLayout(createMemoryStorage())).toEqual({ kind: 'missing' });
    expect(readWorkspaceLayout(null)).toEqual({ kind: 'unavailable' });
  });

  it.each([
    '{broken',
    JSON.stringify({ version: 99, layout }),
    JSON.stringify({ version: 1, layout: { panels: [] } }),
  ])('invalidates malformed or unsupported data: %s', (raw) => {
    const storage = createMemoryStorage();
    storage.values.set(WORKSPACE_LAYOUT_STORAGE_KEY, raw);

    expect(readWorkspaceLayout(storage)).toEqual({ kind: 'invalid' });
    expect(storage.values.has(WORKSPACE_LAYOUT_STORAGE_KEY)).toBe(false);
  });

  it('contains browser storage failures', () => {
    const unavailable = {
      getItem: vi.fn(() => { throw new DOMException('denied'); }),
      setItem: vi.fn(() => { throw new DOMException('quota'); }),
      removeItem: vi.fn(() => { throw new DOMException('denied'); }),
    };

    expect(readWorkspaceLayout(unavailable)).toEqual({ kind: 'unavailable' });
    expect(writeWorkspaceLayout(unavailable, layout)).toBe(false);
    expect(removeWorkspaceLayout(unavailable)).toBe(false);
  });
});
