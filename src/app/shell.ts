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
import { createPhoenixAssetClient } from '../phoenix/asset-client';
import { createPhoenixSectionClient } from '../phoenix/section-client';
import {
  syncPublishedPoolFilesToPhoenix,
  type ProjectPoolSyncProgress,
} from '../services/project-pool-sync';
import { ProjectSectionSyncError, syncProjectBarsToPhoenix, type ProjectSectionSyncProgress } from '../services/project-section-sync';

export interface AppShell {
  mount(): void;
}

export function createAppShell(root: HTMLElement): AppShell {
  const SIDE_PANEL_WIDTH_RATIO = 0.15;
  const state = createAppState();
  const dbState = createDbState();
  const sessionRef = createDbSessionRef();
  const connection = createConnectionController(state);
  const panels = createPanelRegistry(state, dbState, sessionRef, connection);
  const workspace = createDockviewWorkspace({
    state,
    panels,
    onPanelOpened: (panelId) => {
      if (panelId === 'preview') {
        enablePhoenixPreview();
      }
    },
    onPanelClosed: (panelId) => {
      if (panelId === 'preview') {
        disablePhoenixPreview();
      }
    },
  });
  const phoenixAssets = createPhoenixAssetClient();
  const phoenixSections = createPhoenixSectionClient();

  let session: DbSession | null = null;
  let poolSyncModal: PoolSyncModal | null = null;
  let lastInspectorSelectionId: number | null = null;
  let lastConnectionStatus = state.getSnapshot().connectionStatus;
  let lastEventCount = state.getSnapshot().events.length;

  const fsSupported = isFileSystemAccessSupported();

  const menuBar = createMenuBar({
    actions: buildMenuActions(dbState.getSnapshot()),
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
          workspace.openPanel('resources', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
          break;
        case 'toggle-timeline':
          workspace.openPanel('timeline');
          break;
        case 'toggle-preview':
          workspace.openPanel('preview');
          break;
        case 'toggle-inspector':
          workspace.openPanel('inspector', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
          break;
        case 'toggle-events':
          workspace.openPanel('events');
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

    await openProjectHandle(handle);
  }

  async function openProjectHandle(handle: FileSystemFileHandle): Promise<void> {
    dbState.setOpening();
    state.clearResourceSelection();
    workspace.closePanel('resources');
    workspace.closePanel('inspector');
    workspace.closePanel('timeline');
    workspace.closePanel('events');
    let nextSession: DbSession | null = null;
    try {
      session?.close();
      session = null;
      sessionRef.current = null;
      nextSession = await openDbSession(handle);
      await syncOpenedProjectPool(nextSession);
      session = nextSession;
      sessionRef.current = session;
      dbState.setOpen(session.fileName);
      workspace.closePanel('inspector');
      workspace.openPanel('timeline');
      workspace.openPanel('resources', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
    } catch (err) {
      nextSession?.close();
      session = null;
      sessionRef.current = null;
      state.clearResourceSelection();
      dbState.clear();
      if (!isAbortError(err)) {
        window.alert(err instanceof Error ? err.message : 'Failed to open database.');
      }
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
      poolSyncModal = createPoolSyncModal(shell);
      root.append(poolSyncModal.element);

      workspace.mount(workspaceElement);
      connection.syncStatusLabel();

      state.subscribe((snapshot) => {
        updateStatusBadge(shell, snapshot.connectionLabel, snapshot.connectionStatus);
        if (snapshot.connectionStatus === 'connected' && lastConnectionStatus !== 'connected') {
          if (workspace.isPanelOpen('preview')) {
            enablePhoenixPreview();
          }
        }
        lastConnectionStatus = snapshot.connectionStatus;
        if (snapshot.resourceSelection.kind === 'file' && snapshot.resourceSelection.id !== lastInspectorSelectionId) {
          lastInspectorSelectionId = snapshot.resourceSelection.id;
          workspace.openPanel('inspector', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
        } else if (snapshot.resourceSelection.kind !== 'file') {
          lastInspectorSelectionId = null;
        }
        if (snapshot.events.length > lastEventCount) {
          workspace.openPanel('events');
        }
        lastEventCount = snapshot.events.length;
      });

      dbState.subscribe((snapshot) => {
        updateDbBadge(shell, snapshot);
        syncMenuDisabled(snapshot);
      });

      connection.subscribeWebRtc((message) => {
        if (message.type === 'webrtc.offer') {
          workspace.openPanel('preview');
        }
      });
    },
  };

  function enablePhoenixPreview(): void {
    if (connection.isConnected()) {
      connection.send({ type: 'webrtc.enable' });
    }
  }

  function disablePhoenixPreview(): void {
    if (connection.isConnected()) {
      connection.send({ type: 'webrtc.disable' });
    }
  }

  function syncMenuDisabled(snapshot: DbSnapshot): void {
    menuBar.updateActions(buildMenuActions(snapshot));
  }

  function buildMenuActions(snapshot: DbSnapshot) {
    const hasFile = snapshot.status === 'open' || snapshot.status === 'saving';
    return createDefaultMenuActions().map((action) => {
      const fileActionDisabled = !fsSupported && ['open-database', 'save-database', 'save-database-as'].includes(action.id);
      if (action.id === 'save-database' || action.id === 'save-database-as') {
        return { ...action, disabled: fileActionDisabled || !hasFile };
      }
      if (fileActionDisabled) return { ...action, disabled: true };
      return action;
    });
  }

  async function syncOpenedProjectPool(openedSession: DbSession): Promise<void> {
    const abortController = new AbortController();
    poolSyncModal?.show(abortController);
    try {
      await syncPublishedPoolFilesToPhoenix(openedSession.data, phoenixAssets, (progress) => {
        poolSyncModal?.update(progress);
      }, { signal: abortController.signal });
      try {
        const sectionSync = await syncProjectBarsToPhoenix(openedSession.data, phoenixSections, (progress) => {
          poolSyncModal?.update(progress);
        }, { signal: abortController.signal });
        recordSectionIssues(sectionSync.issues);
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (err instanceof ProjectSectionSyncError) {
          recordSectionIssues(err.issues);
        } else if (err instanceof Error) {
          state.addEvent({
            severity: 'error',
            source: 'Phoenix section sync',
            description: err.message,
          });
          workspace.openPanel('events');
        }
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof Error) {
        state.addEvent({
          severity: 'error',
          source: 'Phoenix project sync',
          description: err.message,
        });
        workspace.openPanel('events');
      }
      poolSyncModal?.update({
        phase: 'error',
        current: 0,
        total: 0,
        copied: 0,
        skipped: 0,
        failed: 0,
        message: err instanceof Error ? `Phoenix pool sync failed: ${err.message}` : 'Phoenix pool sync failed.',
      });
      throw err;
    } finally {
      poolSyncModal?.hide();
    }
  }

  function recordSectionIssues(issues: ProjectSectionSyncError['issues']): void {
    if (issues.length === 0) return;
    state.addEvents(issues.map((issue) => ({
      severity: 'error',
      source: 'Phoenix section sync',
      subjectId: String(issue.barId),
      description: issue.description,
    })));
    workspace.openPanel('events');
  }
}

interface PoolSyncModal {
  element: HTMLElement;
  show(controller: AbortController): void;
  update(progress: ProjectPoolSyncProgress | ProjectSectionSyncProgress): void;
  hide(): void;
}

function createPoolSyncModal(shell: HTMLElement): PoolSyncModal {
  const overlay = document.createElement('div');
  overlay.className = 'pool-sync-modal';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'pool-sync-modal-title');

  const dialog = document.createElement('div');
  dialog.className = 'pool-sync-modal__dialog';

  const title = document.createElement('h2');
  title.id = 'pool-sync-modal-title';
  title.className = 'pool-sync-modal__title';
  title.textContent = 'Syncing Phoenix project';

  const indicator = document.createElement('div');
  indicator.className = 'pool-sync-indicator';
  indicator.dataset.phase = 'idle';

  const label = document.createElement('div');
  label.className = 'pool-sync-indicator__label';

  const progress = document.createElement('progress');
  progress.className = 'pool-sync-indicator__progress';
  progress.max = 1;
  progress.value = 0;

  indicator.append(label, progress);
  const actions = document.createElement('div');
  actions.className = 'pool-sync-modal__actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pool-sync-modal__cancel';
  cancel.textContent = 'Cancel';
  actions.append(cancel);

  dialog.append(title, indicator, actions);
  overlay.append(dialog);

  let activeController: AbortController | null = null;
  cancel.addEventListener('click', () => {
    activeController?.abort(new DOMException('Pool sync cancelled.', 'AbortError'));
    cancel.disabled = true;
    label.textContent = 'Cancelling sync...';
  });

  function setShellBlocked(blocked: boolean): void {
    (shell as HTMLElement & { inert?: boolean }).inert = blocked;
    shell.setAttribute('aria-hidden', blocked ? 'true' : 'false');
  }

  return {
    element: overlay,
    show(controller): void {
      activeController = controller;
      cancel.disabled = false;
      overlay.hidden = false;
      indicator.dataset.phase = 'scanning';
      label.textContent = 'Preparing Phoenix pool sync...';
      progress.max = 1;
      progress.value = 0;
      setShellBlocked(true);
      cancel.focus();
    },
    update(nextProgress): void {
      updatePoolSyncIndicator(indicator, nextProgress);
    },
    hide(): void {
      activeController = null;
      overlay.hidden = true;
      setShellBlocked(false);
    },
  };
}

function updatePoolSyncIndicator(indicator: HTMLElement | null, progress: ProjectPoolSyncProgress | ProjectSectionSyncProgress): void {
  if (!indicator) return;

  const label = indicator.querySelector<HTMLElement>('.pool-sync-indicator__label');
  const progressBar = indicator.querySelector<HTMLProgressElement>('.pool-sync-indicator__progress');
  const total = Math.max(progress.total, 1);

  indicator.hidden = false;
  indicator.dataset.phase = progress.phase;
  if (label) {
    const count = progress.total > 0 ? ` (${progress.current}/${progress.total})` : '';
    label.textContent = `${progress.message}${count}`;
  }
  if (progressBar) {
    progressBar.max = total;
    progressBar.value = progress.phase === 'scanning' ? 0 : Math.min(progress.current, total);
  }
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === 'AbortError';
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
  if (badge.dataset.status === status && badge.textContent === label) return;
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
