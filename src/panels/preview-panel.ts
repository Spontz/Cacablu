import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import { createContentRenderer } from './base-panel';

export function createPreviewPanel(state: AppState): IContentRenderer {
  return createContentRenderer((element) => {
      element.className = 'panel panel--preview';
      const title = document.createElement('h2');
      title.textContent = 'Preview';

      const text = document.createElement('p');
      text.className = 'panel-note';
      text.textContent = `Shell ready. Engine status: ${state.getSnapshot().connectionLabel}.`;

      element.replaceChildren(title, text);

      state.subscribe((snapshot) => {
        text.textContent = `Shell ready. Engine status: ${snapshot.connectionLabel}.`;
      });
  });
}
