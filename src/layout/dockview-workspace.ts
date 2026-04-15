import { DockviewComponent } from 'dockview-core';

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
  focusPanel(panelId: string): void;
}

export function createDockviewWorkspace(options: WorkspaceOptions): DockviewWorkspace {
  let dockview: DockviewComponent | null = null;

  function applyDefaultLayout(): void {
    if (!dockview) {
      return;
    }

    dockview.clear();

    dockview.addPanel({
      id: 'preview',
      component: 'preview-panel',
      title: 'Preview',
      renderer: 'always',
    });

    dockview.addPanel({
      id: 'resources',
      component: 'resources-panel',
      title: 'Resources',
      renderer: 'always',
      position: {
        referencePanel: 'preview',
        direction: 'left',
      },
    });

    dockview.addPanel({
      id: 'inspector',
      component: 'inspector-panel',
      title: 'Inspector',
      renderer: 'always',
      position: {
        referencePanel: 'preview',
        direction: 'right',
      },
    });

    dockview.addPanel({
      id: 'timeline',
      component: 'timeline-panel',
      title: 'Timeline',
      renderer: 'always',
      position: {
        referencePanel: 'preview',
        direction: 'below',
      },
    });

    dockview.addPanel({
      id: 'events',
      component: 'events-panel',
      title: 'Events',
      renderer: 'always',
      position: {
        referencePanel: 'timeline',
        direction: 'within',
      },
    });
  }

  return {
    mount(container: HTMLElement): void {
      dockview = new DockviewComponent(container, {
        createComponent: (component) => options.panels.create(component.name),
      });

      dockview.onDidActivePanelChange((panel) => {
        options.state.setActivePanel(panel?.id ?? null);
      });

      applyDefaultLayout();

      const timelinePanel = dockview.getGroupPanel('timeline');
      if (timelinePanel) {
        dockview.setActivePanel(timelinePanel);
      }
    },

    resetLayout(): void {
      applyDefaultLayout();
    },

    focusPanel(panelId: string): void {
      if (!dockview) {
        return;
      }

      const panel = dockview.getGroupPanel(panelId);
      if (panel) {
        dockview.setActivePanel(panel);
        panel.focus();
      }
    },
  };
}

export function findPanelDefinition(panelId: string): PanelDefinition | undefined {
  return DEFAULT_PANELS.find((panel) => panel.id === panelId);
}
