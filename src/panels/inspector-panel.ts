import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import { createContentRenderer } from './base-panel';

export function createInspectorPanel(state: AppState): IContentRenderer {
  return createContentRenderer((element) => {
      const title = document.createElement('h2');
      title.textContent = 'Inspector';

      const detail = document.createElement('p');
      detail.className = 'panel-note';
      detail.textContent = state.getSnapshot().activePanelId
        ? `Active panel: ${state.getSnapshot().activePanelId}`
        : 'Select a panel to inspect its future details.';

      element.replaceChildren(title, detail);

      state.subscribe((snapshot) => {
        detail.textContent = snapshot.activePanelId
          ? `Active panel: ${snapshot.activePanelId}`
          : 'Select a panel to inspect its future details.';
      });
  });
}
