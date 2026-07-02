import { DockviewComponent } from 'dockview-core';
import type { AddPanelPositionOptions, ITabRenderer, TabPartInitParameters } from 'dockview-core';

import { DEFAULT_PANELS } from './default-layout';
import type { PanelDefinition } from '../app/types';
import type { PanelRegistry } from '../panels/panel-registry';
import type { AppState } from '../state/app-state';

interface WorkspaceOptions {
  state: AppState;
  panels: PanelRegistry;
}

export interface DockviewWorkspace {
  mount(container: HTMLElement): void;
  resetLayout(): void;
  openPanel(panelId: string, options?: OpenPanelOptions): void;
  closePanel(panelId: string): void;
  openFloating(id: string, component: string, title: string): void;
}

interface OpenPanelOptions {
  widthRatio?: number;
}

export function createDockviewWorkspace(options: WorkspaceOptions): DockviewWorkspace {
  let dockview: DockviewComponent | null = null;
  let workspaceContainer: HTMLElement | null = null;

  function addDockedPanel(panel: PanelDefinition, panelOptions: OpenPanelOptions = {}): void {
    if (!dockview) {
      return;
    }

    const position = getRestorePosition(panel.id);
    const initialWidth = getInitialWidth(panelOptions);
    const addedPanel = dockview.addPanel({
      id: panel.id,
      component: panel.component,
      title: panel.title,
      renderer: 'always',
      ...(initialWidth ? { initialWidth } : {}),
      ...(position ? { position } : {}),
    });

    dockview.setActivePanel(addedPanel);
    addedPanel.focus();
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
        dockview.setActivePanel(panel);
        panel.focus();
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

    openFloating(id: string, component: string, title: string): void {
      if (!dockview) return;

      const existing = dockview.getGroupPanel(id);
      if (existing) {
        dockview.setActivePanel(existing);
        existing.focus();
        return;
      }

      dockview.addPanel({
        id,
        component,
        title,
        renderer: 'always',
        floating: { width: 640, height: 420, x: 80, y: 60 },
      });
    },
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

  element.append(label, badge);

  let params: TabPartInitParameters | null = null;
  let unsubscribe: (() => void) | null = null;

  function render(): void {
    if (!params) return;

    label.textContent = params.api.title ?? params.api.id;
    const unread = state.getSnapshot().unreadEventCount;
    const showBadge = params.api.id === 'events' && unread > 0;
    badge.hidden = !showBadge;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    element.dataset.panelId = params.api.id;
    element.dataset.hasUnread = showBadge ? 'true' : 'false';
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
