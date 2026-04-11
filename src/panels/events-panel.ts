import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import { createContentRenderer } from './base-panel';

export function createEventsPanel(state: AppState): IContentRenderer {
  return createContentRenderer((element) => {
      const title = document.createElement('h2');
      title.textContent = 'Events';

      const list = document.createElement('ul');
      list.className = 'panel-list';

      const render = (): void => {
        const snapshot = state.getSnapshot();
        list.innerHTML = '';

        const items = [
          `Connection: ${snapshot.connectionLabel}`,
          `Active panel: ${snapshot.activePanelId ?? 'none'}`,
          `Last error: ${snapshot.lastError ?? 'none'}`,
        ];

        for (const item of items) {
          const li = document.createElement('li');
          li.textContent = item;
          list.append(li);
        }
      };

      render();
      element.replaceChildren(title, list);

      state.subscribe(render);
  });
}
