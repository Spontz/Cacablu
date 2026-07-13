import { DockviewComponent } from 'dockview-core';
import type { AddPanelPositionOptions, ITabRenderer, TabPartInitParameters } from 'dockview-core';

import { DEFAULT_PANELS } from './default-layout';
import type { PanelDefinition } from '../app/types';
import type { PanelRegistry } from '../panels/panel-registry';
import type { AppState } from '../state/app-state';

interface WorkspaceOptions {
  state: AppState;
  panels: PanelRegistry;
  onPanelOpened?: (panelId: string) => void;
  onPanelClosed?: (panelId: string) => void;
}

export interface DockviewWorkspace {
  mount(container: HTMLElement): void;
  resetLayout(): void;
  openPanel(panelId: string, options?: OpenPanelOptions): void;
  closePanel(panelId: string): void;
  isPanelOpen(panelId: string): boolean;
  openFloating(id: string, component: string, title: string, params?: Record<string, unknown>): void;
}

interface OpenPanelOptions {
  widthRatio?: number;
  activate?: boolean;
  preserveActivePanel?: boolean;
}

export function createDockviewWorkspace(options: WorkspaceOptions): DockviewWorkspace {
  let dockview: DockviewComponent | null = null;
  let workspaceContainer: HTMLElement | null = null;

  function addDockedPanel(panel: PanelDefinition, panelOptions: OpenPanelOptions = {}): void {
    if (!dockview) {
      return;
    }

    const previousActivePanel = panelOptions.preserveActivePanel ? dockview.activePanel : undefined;
    const position = getRestorePosition(panel.id);
    const initialWidth = getInitialWidth(panelOptions);
    const addedPanel = dockview.addPanel({
      id: panel.id,
      component: panel.component,
      title: panel.title,
      ...(panel.id === 'events' ? { tabComponent: 'shell-tab' } : {}),
      renderer: 'always',
      inactive: panelOptions.activate === false,
      ...(initialWidth ? { initialWidth } : {}),
      ...(position ? { position } : {}),
    });

    if (panelOptions.activate !== false) {
      dockview.setActivePanel(addedPanel);
      if (previousActivePanel && previousActivePanel !== addedPanel) {
        dockview.setActivePanel(previousActivePanel);
        previousActivePanel.focus();
      } else {
        addedPanel.focus();
      }
    }
  }

  function getInitialWidth(options: OpenPanelOptions): number | null {
    if (!workspaceContainer || !options.widthRatio) {
      return null;
    }

    return Math.max(160, Math.round(workspaceContainer.clientWidth * options.widthRatio));
  }

  function getRestorePosition(panelId: string): AddPanelPositionOptions | null {
    if (!dockview || dockview.panels.length === 0) {
      return null;
    }

    const preview = dockview.getGroupPanel('preview');
    const timeline = dockview.getGroupPanel('timeline');
    const mainReference = preview ?? timeline;

    switch (panelId) {
      case 'resources':
        return mainReference ? { referencePanel: mainReference, direction: 'left' } : null;
      case 'inspector':
        return mainReference ? { referencePanel: mainReference, direction: 'right' } : null;
      case 'section-editor':
        return mainReference ? { referencePanel: mainReference, direction: 'right' } : null;
      case 'markers':
        return mainReference ? { referencePanel: mainReference, direction: 'right' } : null;
      case 'preview':
        return timeline ? { referencePanel: timeline, direction: 'above' } : null;
      case 'timeline':
        return preview ? { referencePanel: preview, direction: 'below' } : null;
      case 'events':
        return timeline ? { referencePanel: timeline, direction: 'within' } : null;
      default:
        return null;
    }
  }

  function applyDefaultLayout(): void {
    if (!dockview) {
      return;
    }

    dockview.clear();
  }

  return {
    mount(container: HTMLElement): void {
      workspaceContainer = container;
      dockview = new DockviewComponent(container, {
        createComponent: (component) => options.panels.create(component.name),
        createTabComponent: () => createShellTab(options.state),
      });

      dockview.onDidActivePanelChange((panel) => {
        options.state.setActivePanel(panel?.id ?? null);
      });
      dockview.onDidAddPanel((panel) => {
        options.onPanelOpened?.(panel.id);
      });
      dockview.onDidRemovePanel((panel) => {
        options.onPanelClosed?.(panel.id);
      });

      applyDefaultLayout();
    },

    resetLayout(): void {
      applyDefaultLayout();
    },

    openPanel(panelId: string, panelOptions: OpenPanelOptions = {}): void {
      if (!dockview) {
        return;
      }

      const panel = dockview.getGroupPanel(panelId);
      if (panel) {
        if (panelOptions.activate !== false) {
          const previousActivePanel = panelOptions.preserveActivePanel ? dockview.activePanel : undefined;
          dockview.setActivePanel(panel);
          if (previousActivePanel && previousActivePanel !== panel) {
            dockview.setActivePanel(previousActivePanel);
            previousActivePanel.focus();
          } else {
            panel.focus();
          }
        }
        return;
      }

      const panelDefinition = findPanelDefinition(panelId);
      if (panelDefinition) {
        addDockedPanel(panelDefinition, panelOptions);
      }
    },

    closePanel(panelId: string): void {
      if (!dockview) {
        return;
      }

      const panel = dockview.getGroupPanel(panelId);
      if (panel) {
        dockview.removePanel(panel);
      }
    },

    isPanelOpen(panelId: string): boolean {
      return Boolean(dockview?.getGroupPanel(panelId));
    },

    openFloating(id: string, component: string, title: string, params?: Record<string, unknown>): void {
      if (!dockview) return;

      const existing = dockview.getGroupPanel(id);
      if (existing) {
        dockview.setActivePanel(existing);
        existing.focus();
        return;
      }

      const floatingSize = component === 'graphics-settings-panel'
        ? getCenteredFloatingSize(workspaceContainer, 1040, 720)
        : component === 'demo-settings-panel'
          ? getCenteredFloatingSize(workspaceContainer, 520, 390)
          : getCenteredFloatingSize(workspaceContainer, 640, 420);

      dockview.addPanel({
        id,
        component,
        title,
        renderer: 'always',
        params,
        floating: floatingSize,
      });
    },
  };
}

function getCenteredFloatingSize(container: HTMLElement | null, preferredWidth: number, preferredHeight: number): { width: number; height: number; x: number; y: number } {
  const margin = 32;
  const rect = container?.getBoundingClientRect();
  const viewportWidth = Math.max(320, Math.round(rect?.width ?? window.innerWidth));
  const viewportHeight = Math.max(240, Math.round(rect?.height ?? window.innerHeight));
  const width = Math.min(preferredWidth, Math.max(320, viewportWidth - margin * 2));
  const height = Math.min(preferredHeight, Math.max(240, viewportHeight - margin * 2));

  return {
    width,
    height,
    x: Math.max(margin / 2, Math.round((viewportWidth - width) / 2)),
    y: Math.max(margin / 2, Math.round((viewportHeight - height) / 2)),
  };
}

function createShellTab(state: AppState): ITabRenderer {
  const element = document.createElement('div');
  element.className = 'shell-tab';

  const label = document.createElement('span');
  label.className = 'shell-tab__label';

  const badge = document.createElement('span');
  badge.className = 'shell-tab__badge';
  badge.hidden = true;

  const errorDot = document.createElement('span');
  errorDot.className = 'shell-tab__error-dot';
  errorDot.hidden = true;
  errorDot.setAttribute('aria-hidden', 'true');

  element.append(label, errorDot, badge);

  let params: TabPartInitParameters | null = null;
  let unsubscribe: (() => void) | null = null;

  function render(): void {
    if (!params) return;

    label.textContent = params.api.title ?? params.api.id;
    const snapshot = state.getSnapshot();
    const unread = snapshot.unreadEventCount;
    const showBadge = params.api.id === 'events' && unread > 0;
    const showErrorDot = params.api.id === 'events' && snapshot.hasUnreadErrors;
    badge.hidden = !showBadge;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    errorDot.hidden = !showErrorDot;
    element.dataset.panelId = params.api.id;
    element.dataset.hasUnread = showBadge ? 'true' : 'false';
    element.dataset.hasErrors = showErrorDot ? 'true' : 'false';
    element.title = showErrorDot ? 'Events contains errors' : '';
  }

  return {
    element,
    init(nextParams): void {
      params = nextParams;
      unsubscribe = state.subscribe(render);
      nextParams.api.onDidTitleChange(render);
      render();
    },
    update(): void {
      render();
    },
    dispose(): void {
      unsubscribe?.();
      unsubscribe = null;
      params = null;
    },
  };
}

export function findPanelDefinition(panelId: string): PanelDefinition | undefined {
  return DEFAULT_PANELS.find((panel) => panel.id === panelId);
}
