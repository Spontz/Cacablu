import { createDefaultMenuActions } from '../menu/menu-actions';
import { createMenuBar } from '../menu/menubar';
import { createPanelRegistry } from '../panels/panel-registry';
import { createAppState } from '../state/app-state';
import { createDbState } from '../state/db-state';
import type { DbSnapshot } from '../state/db-state';
import { createConnectionController } from '../ws/connection';
import { createDockviewWorkspace } from '../layout/dockview-workspace';
import { isFileSystemAccessSupported, pickSqliteFile, pickSaveAsFile } from '../db/file-picker';
import { openDbSession, createDbSessionRef } from '../db/db-session';
import type { DbSession } from '../db/db-session';

export interface AppShell {
  mount(): void;
}

export function createAppShell(root: HTMLElement): AppShell {
  const state = createAppState();
  const dbState = createDbState();
  const sessionRef = createDbSessionRef();
  const connection = createConnectionController(state);
  const panels = createPanelRegistry(state, dbState, sessionRef);
  const workspace = createDockviewWorkspace({ state, panels });

  let session: DbSession | null = null;

  const fsSupported = isFileSystemAccessSupported();

  const initialActions = createDefaultMenuActions().map((action) => {
    if (!fsSupported && ['open-database', 'save-database', 'save-database-as'].includes(action.id)) {
      return { ...action, disabled: true };
    }
    return action;
  });

  const menuBar = createMenuBar({
    actions: initialActions,
    runAction: (actionId) => {
      switch (actionId) {
        case 'open-database':
          void handleOpen();
          break;
        case 'save-database':
          void handleSave();
          break;
        case 'save-database-as':
          void handleSaveAs();
          break;
        case 'reset-layout':
          workspace.resetLayout();
          break;
        case 'toggle-db-explorer':
          workspace.openFloating('db-explorer', 'db-explorer-panel', 'Database Explorer');
          break;
        case 'toggle-resources':
          workspace.focusPanel('resources');
          break;
        case 'toggle-timeline':
          workspace.focusPanel('timeline');
          break;
        case 'toggle-preview':
          workspace.focusPanel('preview');
          break;
        case 'toggle-inspector':
          workspace.focusPanel('inspector');
          break;
        case 'toggle-events':
          workspace.focusPanel('events');
          break;
        case 'connection-status':
          connection.cycleDemoState();
          break;
        case 'about-shell':
          window.alert('Cacablu shell skeleton ready for feature work.');
          break;
        default:
          break;
      }
    },
  });

  async function handleOpen(): Promise<void> {
    if (!fsSupported) {
      window.alert('File System Access API is not supported in this browser. Open/save requires a modern desktop browser.');
      return;
    }

    let handle: FileSystemFileHandle | null;
    try {
      handle = await pickSqliteFile();
    } catch {
      window.alert('Could not open file picker. Check browser permissions.');
      return;
    }

    if (!handle) return;

    dbState.setOpening();
    try {
      session?.close();
      session = await openDbSession(handle);
      sessionRef.current = session;
      dbState.setOpen(session.fileName);
    } catch (err) {
      session = null;
      sessionRef.current = null;
      dbState.clear();
      window.alert(err instanceof Error ? err.message : 'Failed to open database.');
    }
  }

  async function handleSave(): Promise<void> {
    if (!session) return;

    dbState.setSaving();
    try {
      await session.save();
      dbState.setSaved();
    } catch (err) {
      dbState.setError(err instanceof Error ? err.message : 'Save failed.');
      window.alert(dbState.getSnapshot().lastError ?? 'Save failed.');
    }
  }

  async function handleSaveAs(): Promise<void> {
    if (!session) return;

    let handle: FileSystemFileHandle | null;
    try {
      handle = await pickSaveAsFile();
    } catch {
      window.alert('Could not open save dialog. Check browser permissions.');
      return;
    }

    if (!handle) return;

    dbState.setSaving();
    try {
      session = await session.saveAs(handle);
      sessionRef.current = session;
      dbState.setOpen(session.fileName);
    } catch (err) {
      dbState.setError(err instanceof Error ? err.message : 'Save failed.');
      window.alert(dbState.getSnapshot().lastError ?? 'Save failed.');
    }
  }

  return {
    mount(): void {
      root.innerHTML = '';
      root.className = 'app-shell-root';

      const shell = document.createElement('div');
      shell.className = 'app-shell';

      const topBar = document.createElement('header');
      topBar.className = 'app-shell__topbar';

      const rightBadges = document.createElement('div');
      rightBadges.className = 'app-shell__badges';

      const dbBadge = createDbBadge(dbState.getSnapshot());
      rightBadges.append(dbBadge, createStatusBadge(state));

      topBar.append(menuBar.element, rightBadges);

      const workspaceElement = document.createElement('main');
      workspaceElement.className = 'app-shell__workspace';

      shell.append(topBar, workspaceElement);
      root.append(shell);

      workspace.mount(workspaceElement);
      connection.syncStatusLabel();

      state.subscribe((snapshot) => {
        updateStatusBadge(shell, snapshot.connectionLabel, snapshot.connectionStatus);
      });

      dbState.subscribe((snapshot) => {
        updateDbBadge(shell, snapshot);
        syncMenuDisabled(snapshot);
      });
    },
  };

  function syncMenuDisabled(snapshot: DbSnapshot): void {
    const hasFile = snapshot.status === 'open' || snapshot.status === 'saving';
    menuBar.updateActions([
      { id: 'save-database', label: 'Guardar', menu: 'File', disabled: !hasFile },
      { id: 'save-database-as', label: 'Guardar como', menu: 'File', disabled: !hasFile },
    ]);
  }
}

function createStatusBadge(state: ReturnType<typeof createAppState>): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'connection-badge';
  badge.dataset.status = state.getSnapshot().connectionStatus;
  badge.textContent = state.getSnapshot().connectionLabel;
  return badge;
}

function updateStatusBadge(root: ParentNode, label: string, status: string): void {
  const badge = root.querySelector<HTMLElement>('.connection-badge');
  if (!badge) return;
  badge.dataset.status = status;
  badge.textContent = label;
}

function createDbBadge(snapshot: DbSnapshot): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'db-badge';
  applyDbBadge(badge, snapshot);
  return badge;
}

function updateDbBadge(root: ParentNode, snapshot: DbSnapshot): void {
  const badge = root.querySelector<HTMLElement>('.db-badge');
  if (!badge) return;
  applyDbBadge(badge, snapshot);
}

function applyDbBadge(badge: HTMLElement, snapshot: DbSnapshot): void {
  const { status, fileName, isDirty, lastError } = snapshot;

  badge.dataset.status = status;

  if (status === 'none') {
    badge.textContent = 'No database open';
    return;
  }

  if (status === 'opening') {
    badge.textContent = 'Opening…';
    return;
  }

  if (status === 'saving') {
    badge.textContent = `${fileName} — saving…`;
    return;
  }

  if (status === 'error') {
    badge.textContent = `${fileName} — ${lastError ?? 'error'}`;
    return;
  }

  badge.textContent = `${fileName}${isDirty ? ' — unsaved' : ' — saved'}`;
}
