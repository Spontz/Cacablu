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
import { createPhoenixDemoSettingsClient } from '../phoenix/demo-settings-client';
import { createPhoenixGraphicsClient } from '../phoenix/graphics-client';
import { createPhoenixRuntimeLoopClient } from '../phoenix/runtime-loop-client';
import { createPhoenixLogClient } from '../phoenix/log-client';
import { primePhoenixLogEvents, recordPhoenixLogsAsEvents } from '../phoenix/log-events';
import { createUndoManager } from './undo-manager';
import { getResourceSelectionSignature } from './selection-signature';
import {
  getSelectedExistingBars,
  hasSelectedExistingBars,
  restoreBarEnabledStates,
  syncBarEnabledChangesToPhoenix,
  toggleSelectedBarEnabledStates,
  type BarEnableToggleResult,
} from '../services/bar-enable-toggle';
import {
  syncPublishedPoolFilesToPhoenix,
  type ProjectPoolSyncProgress,
} from '../services/project-pool-sync';
import { syncProjectDemoSettingsToPhoenix, type ProjectDemoSettingsSyncProgress } from '../services/project-demo-settings-sync';
import { ProjectSectionSyncError, syncProjectBarsToPhoenix, type ProjectSectionSyncProgress } from '../services/project-section-sync';
import { createProjectSyncCoordinator } from '../services/project-sync-coordinator';
import { graphicsConfigFromProject } from '../services/graphics-config';
import { hasNewSectionErrors, shouldDeferEventsOpen, shouldOpenEventsForNewError } from './event-notifications';

export interface AppShell {
  mount(): void;
}

export function createAppShell(root: HTMLElement): AppShell {
  const SIDE_PANEL_WIDTH_RATIO = 0.15;
  const SECTION_EDITOR_WIDTH_RATIO = 0.32;
  const state = createAppState();
  const dbState = createDbState();
  const sessionRef = createDbSessionRef();
  const connection = createConnectionController(state);
  const undoManager = createUndoManager();
  const panels = createPanelRegistry(state, dbState, sessionRef, connection, undoManager);
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
      if (panelId === 'section-editor') {
        lastSectionEditorSelectionId = null;
      }
    },
  });
  const phoenixAssets = createPhoenixAssetClient();
  const phoenixSections = createPhoenixSectionClient();
  const phoenixDemoSettings = createPhoenixDemoSettingsClient();
  const phoenixGraphics = createPhoenixGraphicsClient();
  const phoenixLoop = createPhoenixRuntimeLoopClient();
  const phoenixLogs = createPhoenixLogClient();

  let session: DbSession | null = null;
  let poolSyncModal: PoolSyncModal | null = null;
  let lastInspectorSelectionId: number | null = null;
  let lastSectionEditorSelectionId: string | null = null;
  let lastConnectionStatus = state.getSnapshot().connectionStatus;
  let lastErrorEventRevision = state.getSnapshot().errorEventRevision;
  let lastSectionErrorIds = new Set(state.getSnapshot().sectionErrorIds);
  let pendingEventsOpen = false;
  let lastDisplayTimelineIds = state.getSnapshot().displayTimelineIds;
  let lastResourceSelectionSignature = getResourceSelectionSignature(state.getSnapshot().resourceSelection);
  const projectSyncCoordinator = createProjectSyncCoordinator<DbSession>(
    async (openedSession, signal) => {
      await syncOpenedProjectPool(openedSession, { signal, forceSections: true });
    },
    (error) => {
      state.addEvent({
        severity: 'error',
        source: 'Phoenix project sync',
        description: error instanceof Error ? error.message : 'Could not resynchronize the project after Phoenix reconnected.',
      });
    },
  );

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
        case 'edit-undo':
          void handleUndo();
          break;
        case 'edit-cut':
          runEditCommand('cut');
          break;
        case 'edit-copy':
          runEditCommand('copy');
          break;
        case 'edit-paste':
          runEditCommand('paste');
          break;
        case 'edit-delete':
          runDeleteAction();
          break;
        case 'edit-graphics':
          workspace.openFloating('graphics-settings', 'graphics-settings-panel', 'Graphics');
          break;
        case 'edit-demo-settings':
          workspace.openFloating('demo-settings', 'demo-settings-panel', 'Demo Settings');
          break;
        case 'reset-layout':
          workspace.resetLayout();
          break;
        case 'toggle-display-timeline-ids':
          state.toggleDisplayTimelineIds();
          break;
        case 'select-all-bars':
          selectAllBars();
          break;
        case 'toggle-enable-bars':
          void toggleSelectedBarsEnabled();
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
        case 'toggle-section-editor':
          workspace.openPanel('section-editor', { widthRatio: SECTION_EDITOR_WIDTH_RATIO });
          break;
        case 'toggle-markers':
          workspace.openPanel('markers', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
          break;
        case 'toggle-events':
          workspace.openPanel('events');
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

  async function handleUndo(): Promise<void> {
    const undone = await undoManager.undo();
    if (!undone) {
      runEditCommand('undo');
    }
  }

  function runEditCommand(command: 'undo' | 'cut' | 'copy' | 'paste' | 'delete'): void {
    document.execCommand(command);
  }

  function runDeleteAction(): void {
    const event = new Event('cacablu:edit-delete', { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    runEditCommand('delete');
  }

  function isAppUndoShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'z' && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
  }

  function isOpenShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'o' && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
  }

  function isSaveShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 's' && !event.altKey && (event.ctrlKey || event.metaKey);
  }

  function getClipboardShortcutCommand(event: KeyboardEvent): 'cut' | 'copy' | 'paste' | null {
    if (event.shiftKey || event.altKey || (!event.ctrlKey && !event.metaKey)) return null;
    switch (event.key.toLowerCase()) {
      case 'x':
        return 'cut';
      case 'c':
        return 'copy';
      case 'v':
        return 'paste';
      default:
        return null;
    }
  }

  function isAppDeleteShortcut(event: KeyboardEvent): boolean {
    return (event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  function isSelectAllBarsShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'a' && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
  }

  function isToggleEnableBarsShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'd' && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
  }

  function isTextEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor'));
  }

  function selectAllBars(): void {
    const bars = sessionRef.current?.data.bars ?? [];
    const ids = bars.map((bar) => bar.id).sort((a, b) => a - b);
    if (ids.length === 0) {
      state.clearResourceSelection();
      return;
    }

    state.setResourceSelection(ids.length === 1 ? { kind: 'bar', id: ids[0] } : { kind: 'bars', ids });
  }

  function getSelectedBarIds(): number[] {
    if (!session) return [];
    return getSelectedExistingBars(session.data, state.getSnapshot().resourceSelection).map((bar) => bar.id);
  }

  async function toggleSelectedBarsEnabled(): Promise<void> {
    if (!session) return;
    const selection = state.getSnapshot().resourceSelection;
    const selectedIds = getSelectedBarIds();
    if (selectedIds.length === 0) return;

    const result = toggleSelectedBarEnabledStates(session, selection);
    if (result.changed.length === 0) return;

    state.setResourceSelection(selectedIds.length === 1 ? { kind: 'bar', id: selectedIds[0] } : { kind: 'bars', ids: selectedIds });
    window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
    undoManager.push({
      label: `Toggle enable ${result.changed.length} bars`,
      undo: async () => {
        if (!session) return;
        const undoResult = restoreBarEnabledStates(session, result.changed);
        state.setResourceSelection(selectedIds.length === 1 ? { kind: 'bar', id: selectedIds[0] } : { kind: 'bars', ids: selectedIds });
        window.dispatchEvent(new CustomEvent('cacablu:timeline-bars-changed'));
        await syncBarEnableToggleResult(undoResult);
      },
    });

    await syncBarEnableToggleResult(result);
  }

  async function syncBarEnableToggleResult(result: BarEnableToggleResult): Promise<void> {
    if (!session || !connection.isConnected()) return;
    try {
      await primePhoenixLogEvents(phoenixLogs);
      const syncResult = await syncBarEnabledChangesToPhoenix(session.data, result, connection, phoenixSections);
      await recordRecentPhoenixLogs();
      if (syncResult.deletedIds.length > 0) {
        state.clearSectionErrors(syncResult.deletedIds);
        state.clearEventsForSubjects(syncResult.deletedIds.map(String), ['Phoenix section sync']);
      }
      recordSectionIssues(syncResult.issues);
    } catch (err) {
      if (err instanceof ProjectSectionSyncError) {
        recordSectionIssues(err.issues);
        return;
      }
      state.addEvent({
        severity: 'error',
        source: 'Phoenix section sync',
        description: err instanceof Error ? err.message : 'Could not sync bar enabled state to Phoenix.',
      });
    }
  }

  async function openProjectHandle(handle: FileSystemFileHandle): Promise<void> {
    dbState.setOpening();
    state.clearResourceSelection();
    state.resetSectionErrors();
    state.setActiveLoop(null);
    undoManager.clear();
    projectSyncCoordinator.setSession(null);
    workspace.closePanel('resources');
    workspace.closePanel('inspector');
    workspace.closePanel('section-editor');
    workspace.closePanel('timeline');
    workspace.closePanel('events');
    let nextSession: DbSession | null = null;
    try {
      session?.close();
      session = null;
      sessionRef.current = null;
      nextSession = await openDbSession(handle);
      if (connection.isConnected()) {
        await syncOpenedProjectPool(nextSession);
      }
      session = nextSession;
      sessionRef.current = session;
      projectSyncCoordinator.setSession(session, connection.isConnected());
      dbState.setOpen(session.fileName);
      workspace.closePanel('inspector');
      workspace.openPanel('timeline');
      flushPendingEventsOpen();
      workspace.openPanel('resources', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
    } catch (err) {
      nextSession?.close();
      session = null;
      sessionRef.current = null;
      projectSyncCoordinator.setSession(null);
      state.clearResourceSelection();
      dbState.clear();
      flushPendingEventsOpen();
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
        const newErrorEvent = shouldOpenEventsForNewError(
          lastErrorEventRevision,
          snapshot.errorEventRevision,
          workspace.isPanelOpen('events'),
        );
        const newSectionError = hasNewSectionErrors(lastSectionErrorIds, snapshot.sectionErrorIds);
        if ((newErrorEvent || newSectionError) && !workspace.isPanelOpen('events')) {
          pendingEventsOpen = true;
        }
        lastErrorEventRevision = snapshot.errorEventRevision;
        lastSectionErrorIds = new Set(snapshot.sectionErrorIds);
        flushPendingEventsOpen();
        if (snapshot.connectionStatus === 'connected' && lastConnectionStatus !== 'connected') {
          if (workspace.isPanelOpen('preview')) {
            enablePhoenixPreview();
          }
          void projectSyncCoordinator.onConnected();
        } else if (snapshot.connectionStatus !== 'connected' && lastConnectionStatus === 'connected') {
          projectSyncCoordinator.onDisconnected();
        }
        lastConnectionStatus = snapshot.connectionStatus;
        if (snapshot.assetSelection.kind === 'file' && snapshot.assetSelection.id !== lastInspectorSelectionId) {
          lastInspectorSelectionId = snapshot.assetSelection.id;
          workspace.openPanel('inspector', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
        } else if (snapshot.assetSelection.kind !== 'file') {
          lastInspectorSelectionId = null;
        }
        const sectionEditorSelectionId = snapshot.resourceSelection.kind === 'bar'
          ? String(snapshot.resourceSelection.id)
          : snapshot.resourceSelection.kind === 'bars'
            ? [...snapshot.resourceSelection.ids].sort((a, b) => a - b).join(',')
            : null;
        if (
          sectionEditorSelectionId !== null &&
          (sectionEditorSelectionId !== lastSectionEditorSelectionId || !workspace.isPanelOpen('section-editor'))
        ) {
          lastSectionEditorSelectionId = sectionEditorSelectionId;
          workspace.openPanel('section-editor', { widthRatio: SECTION_EDITOR_WIDTH_RATIO });
        } else if (sectionEditorSelectionId === null) {
          lastSectionEditorSelectionId = null;
        }
        if (snapshot.displayTimelineIds !== lastDisplayTimelineIds) {
          lastDisplayTimelineIds = snapshot.displayTimelineIds;
          syncMenuDisabled(dbState.getSnapshot());
        }
        const resourceSelectionSignature = getResourceSelectionSignature(snapshot.resourceSelection);
        if (resourceSelectionSignature !== lastResourceSelectionSignature) {
          lastResourceSelectionSignature = resourceSelectionSignature;
          syncMenuDisabled(dbState.getSnapshot());
        }
      });

      dbState.subscribe((snapshot) => {
        updateDbBadge(shell, snapshot);
        syncMenuDisabled(snapshot);
      });

      undoManager.subscribe(() => {
        syncMenuDisabled(dbState.getSnapshot());
      });

      connection.subscribeWebRtc((message) => {
        if (message.type === 'webrtc.offer') {
          workspace.openPanel('preview');
        }
      });

      window.addEventListener('cacablu:open-glsl-editor', (event) => {
        const detail = event instanceof CustomEvent ? event.detail as { fileId?: unknown; name?: unknown } : null;
        const fileId = typeof detail?.fileId === 'number' && Number.isFinite(detail.fileId) ? detail.fileId : null;
        const name = typeof detail?.name === 'string' && detail.name ? detail.name : 'GLSL Editor';
        if (fileId === null) {
          workspace.openFloating('glsl-asset-editor', 'glsl-asset-editor-panel', 'GLSL Editor');
          return;
        }
        workspace.openFloating(
          `glsl-asset-editor-${fileId}`,
          'glsl-asset-editor-panel',
          name,
          { fileId },
        );
      });

      window.addEventListener('cacablu:open-timeline', () => {
        workspace.openPanel('timeline');
      });

      window.addEventListener('cacablu:open-markers-panel', (event) => {
        const detail = event instanceof CustomEvent ? event.detail as { markerId?: unknown } : null;
        const markerId = typeof detail?.markerId === 'number' && Number.isFinite(detail.markerId)
          ? detail.markerId
          : null;
        workspace.openPanel('markers', { widthRatio: SIDE_PANEL_WIDTH_RATIO });
        if (markerId === null) return;
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('cacablu:markers-panel-select', {
            detail: { markerId },
          }));
        });
      });

      window.addEventListener('keydown', (event) => {
        if (!isOpenShortcut(event)) {
          return;
        }

        event.preventDefault();
        void handleOpen();
      });

      window.addEventListener('keydown', (event) => {
        if (!isSaveShortcut(event) || !session) {
          return;
        }

        event.preventDefault();
        if (event.shiftKey) {
          void handleSaveAs();
        } else {
          void handleSave();
        }
      });

      window.addEventListener('keydown', (event) => {
        if (!isAppUndoShortcut(event) || isTextEditingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        void handleUndo();
      });

      window.addEventListener('keydown', (event) => {
        if (isTextEditingTarget(event.target)) {
          return;
        }

        const command = getClipboardShortcutCommand(event);
        if (!command) {
          return;
        }

        event.preventDefault();
        runEditCommand(command);
      });

      window.addEventListener('keydown', (event) => {
        if (!isAppDeleteShortcut(event) || isTextEditingTarget(event.target)) {
          return;
        }

        const deleteEvent = new Event('cacablu:edit-delete', { cancelable: true });
        if (!window.dispatchEvent(deleteEvent)) {
          event.preventDefault();
        }
      });

      window.addEventListener('keydown', (event) => {
        if (!isSelectAllBarsShortcut(event) || isTextEditingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        selectAllBars();
      });

      window.addEventListener('keydown', (event) => {
        if (!isToggleEnableBarsShortcut(event) || isTextEditingTarget(event.target)) {
          return;
        }

        if (getSelectedBarIds().length === 0) return;
        event.preventDefault();
        void toggleSelectedBarsEnabled();
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
      if (action.id === 'edit-undo') {
        return { ...action, disabled: !undoManager.canUndo() };
      }
      if (action.id === 'save-database' || action.id === 'save-database-as') {
        return { ...action, disabled: fileActionDisabled || !hasFile };
      }
      if (action.id === 'toggle-display-timeline-ids') {
        return {
          ...action,
          label: state.getSnapshot().displayTimelineIds ? 'Ocultar IDs' : 'Display IDs',
        };
      }
      if (action.id === 'select-all-bars') {
        return { ...action, disabled: !session || session.data.bars.length === 0 };
      }
      if (action.id === 'toggle-enable-bars') {
        return {
          ...action,
          disabled: !hasSelectedExistingBars(session?.data ?? null, state.getSnapshot().resourceSelection),
        };
      }
      if (fileActionDisabled) return { ...action, disabled: true };
      return action;
    });
  }

  async function syncOpenedProjectPool(
    openedSession: DbSession,
    options: { signal?: AbortSignal; forceSections?: boolean } = {},
  ): Promise<void> {
    if (!connection.isConnected()) {
      throw new Error('Could not connect to Phoenix.');
    }

    const abortController = new AbortController();
    const abortFromParent = () => abortController.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromParent();
    else options.signal?.addEventListener('abort', abortFromParent, { once: true });
    const signal = abortController.signal;
    poolSyncModal?.show(abortController);
    try {
      await syncPublishedPoolFilesToPhoenix(openedSession.data, phoenixAssets, (progress) => {
        poolSyncModal?.update(progress);
      }, { signal });
      await syncProjectDemoSettingsToPhoenix(openedSession.data, phoenixDemoSettings, (progress) => {
        poolSyncModal?.update(progress);
      }, { signal });
      const graphicsResult = await phoenixGraphics.putConfig(graphicsConfigFromProject(openedSession.data), signal);
      for (const warning of graphicsResult.warnings) {
        state.addEvent({ severity: 'warning', source: 'Graphics', description: warning.message });
      }
      let stopLogCapture: (() => void) | null = null;
      try {
        await primePhoenixLogEvents(phoenixLogs, signal);
        stopLogCapture = startPhoenixLogCapture(signal);
        const sectionSync = await syncProjectBarsToPhoenix(openedSession.data, phoenixSections, (progress) => {
          poolSyncModal?.update(progress);
        }, { signal, forceReplace: options.forceSections });
        await recordRecentPhoenixLogs(signal);
        recordSectionIssues(sectionSync.issues);
        const activeLoop = state.getSnapshot().activeLoop;
        if (activeLoop) await phoenixLoop.putLoop(activeLoop, signal);
      } catch (err) {
        if (isAbortError(err)) throw err;
        await recordRecentPhoenixLogs(signal);
        if (err instanceof ProjectSectionSyncError) {
          recordSectionIssues(err.issues);
        } else if (err instanceof Error) {
          state.addEvent({
            severity: 'error',
            source: 'Phoenix section sync',
            description: err.message,
          });
          throw err;
        }
      } finally {
        stopLogCapture?.();
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof Error) {
        poolSyncModal?.update({
          phase: 'error',
          current: 0,
          total: 0,
          copied: 0,
          skipped: 0,
          failed: 0,
          message: `Phoenix project sync failed: ${err.message}`,
        });
      }
      throw err;
    } finally {
      options.signal?.removeEventListener('abort', abortFromParent);
      poolSyncModal?.hide();
    }
  }

  function flushPendingEventsOpen(): void {
    if (!pendingEventsOpen) return;
    if (workspace.isPanelOpen('events')) {
      pendingEventsOpen = false;
      return;
    }
    if (shouldDeferEventsOpen(dbState.getSnapshot().status === 'opening', workspace.isPanelOpen('timeline'))) return;

    workspace.openPanel('events', { activate: false });
    pendingEventsOpen = false;
  }

  function recordSectionIssues(issues: ProjectSectionSyncError['issues']): void {
    if (issues.length === 0) return;
    state.addEvents(issues.map((issue) => ({
      severity: 'error',
      source: 'Phoenix section sync',
      subjectId: String(issue.barId),
      description: issue.description,
    })));
    state.markSectionErrors(issues.map((issue) => issue.barId));
  }

  function startPhoenixLogCapture(signal: AbortSignal): () => void {
    let stopped = false;
    const timer = window.setInterval(() => {
      if (stopped || signal.aborted) return;
      void recordRecentPhoenixLogs(signal);
    }, 50);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }

  async function recordRecentPhoenixLogs(signal?: AbortSignal): Promise<void> {
    const result = await recordPhoenixLogsAsEvents(state, phoenixLogs, signal);
    if (result.errorSubjectIds.length > 0) {
      state.markSectionErrors(result.errorSubjectIds);
    }
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

  const progress = document.createElement('div');
  progress.className = 'pool-sync-indicator__progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.style.setProperty('--pool-sync-progress', '0%');
  const progressFill = document.createElement('div');
  progressFill.className = 'pool-sync-indicator__progress-fill';
  progress.append(progressFill);

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
      indicator.dataset.mode = 'indeterminate';
      label.textContent = 'Preparing Phoenix pool sync...';
      progress.removeAttribute('aria-valuenow');
      progress.style.setProperty('--pool-sync-progress', '0%');
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

function updatePoolSyncIndicator(
  indicator: HTMLElement | null,
  progress: ProjectPoolSyncProgress | ProjectDemoSettingsSyncProgress | ProjectSectionSyncProgress,
): void {
  if (!indicator) return;

  const label = indicator.querySelector<HTMLElement>('.pool-sync-indicator__label');
  const progressBar = indicator.querySelector<HTMLElement>('.pool-sync-indicator__progress');
  const total = Math.max(progress.total, 1);
  const isIndeterminate = Boolean(progress.indeterminate) || progress.total <= 0;

  indicator.hidden = false;
  indicator.dataset.phase = progress.phase;
  indicator.dataset.mode = isIndeterminate ? 'indeterminate' : 'determinate';
  if (label) {
    const count = !isIndeterminate && progress.total > 0 ? ` (${progress.current}/${progress.total})` : '';
    label.textContent = `${progress.message}${count}`;
  }
  if (progressBar) {
    if (isIndeterminate) {
      progressBar.removeAttribute('aria-valuenow');
      progressBar.style.setProperty('--pool-sync-progress', '0%');
    } else {
      const value = Math.min(progress.current, total);
      const percent = Math.max(0, Math.min(100, (value / total) * 100));
      progressBar.setAttribute('aria-valuenow', String(Math.round(percent)));
      progressBar.style.setProperty('--pool-sync-progress', `${percent}%`);
    }
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
