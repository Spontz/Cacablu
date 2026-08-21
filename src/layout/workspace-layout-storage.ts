import type { SerializedDockview } from 'dockview-core';

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'cacablu.workspace.layout';
export const WORKSPACE_LAYOUT_VERSION = 1;

export type WorkspaceLayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface StoredWorkspaceLayout {
  version: typeof WORKSPACE_LAYOUT_VERSION;
  layout: SerializedDockview;
}

export type WorkspaceLayoutReadResult =
  | { kind: 'restored'; layout: SerializedDockview }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

export function readWorkspaceLayout(storage: WorkspaceLayoutStorage | null): WorkspaceLayoutReadResult {
  if (!storage) return { kind: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
  } catch {
    return { kind: 'unavailable' };
  }
  if (raw === null) return { kind: 'missing' };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredWorkspaceLayout(parsed)) {
      removeWorkspaceLayout(storage);
      return { kind: 'invalid' };
    }
    return { kind: 'restored', layout: parsed.layout };
  } catch {
    removeWorkspaceLayout(storage);
    return { kind: 'invalid' };
  }
}

export function writeWorkspaceLayout(
  storage: WorkspaceLayoutStorage | null,
  layout: SerializedDockview,
): boolean {
  if (!storage) return false;

  const stored: StoredWorkspaceLayout = {
    version: WORKSPACE_LAYOUT_VERSION,
    layout,
  };
  try {
    storage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function removeWorkspaceLayout(storage: WorkspaceLayoutStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function getBrowserLayoutStorage(): WorkspaceLayoutStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStoredWorkspaceLayout(value: unknown): value is StoredWorkspaceLayout {
  if (!isRecord(value) || value.version !== WORKSPACE_LAYOUT_VERSION || !isRecord(value.layout)) return false;
  const { grid, panels } = value.layout;
  return isRecord(grid)
    && isRecord(grid.root)
    && typeof grid.height === 'number'
    && typeof grid.width === 'number'
    && typeof grid.orientation === 'string'
    && isRecord(panels);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
