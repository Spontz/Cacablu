import { createDefaultMenuActions } from '../menu/menu-actions';
import { createMenuBar } from '../menu/menubar';
import { createPanelRegistry } from '../panels/panel-registry';
import { createAppState } from '../state/app-state';
import { createConnectionController } from '../ws/connection';
import { createDockviewWorkspace } from '../layout/dockview-workspace';

export interface AppShell {
  mount(): void;
}

export function createAppShell(root: HTMLElement): AppShell {
  const state = createAppState();
  const connection = createConnectionController(state);
  const panels = createPanelRegistry(state);
  const workspace = createDockviewWorkspace({
    state,
    panels,
  });

  const menuBar = createMenuBar({
    actions: createDefaultMenuActions(),
    runAction: (actionId) => {
      switch (actionId) {
        case 'reset-layout':
          workspace.resetLayout();
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

  return {
    mount(): void {
      root.innerHTML = '';
      root.className = 'app-shell-root';

      const shell = document.createElement('div');
      shell.className = 'app-shell';

      const topBar = document.createElement('header');
      topBar.className = 'app-shell__topbar';
      topBar.append(menuBar.element, createStatusBadge(state));

      const workspaceElement = document.createElement('main');
      workspaceElement.className = 'app-shell__workspace';

      shell.append(topBar, workspaceElement);
      root.append(shell);

      workspace.mount(workspaceElement);
      connection.syncStatusLabel();
      state.subscribe((snapshot) => {
        updateStatusBadge(shell, snapshot.connectionLabel, snapshot.connectionStatus);
      });
    },
  };
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
  if (!badge) {
    return;
  }

  badge.dataset.status = status;
  badge.textContent = label;
}
