import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import { createContentRenderer } from './base-panel';

export function createEventsPanel(state: AppState): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'events-panel';

    const list = document.createElement('div');
    list.className = 'events-listbox';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Events');
    list.addEventListener('click', () => {
      state.markEventsRead();
    });

    const render = (): void => {
      const snapshot = state.getSnapshot();
      list.innerHTML = '';

      if (snapshot.events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'events-listbox__empty';
        empty.setAttribute('role', 'option');
        empty.setAttribute('aria-selected', 'false');
        empty.textContent = 'No events.';
        list.append(empty);
        return;
      }

      for (const event of snapshot.events) {
        const item = document.createElement('div');
        item.className = 'events-listbox__item';
        item.dataset.severity = event.severity;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        const severity = document.createElement('span');
        severity.className = 'events-listbox__severity';
        severity.textContent = event.severity;

        const description = document.createElement('span');
        description.className = 'events-listbox__description';
        description.textContent = event.description;

        item.append(severity, description);
        if (event.subjectId || event.source) {
          const meta = document.createElement('span');
          meta.className = 'events-listbox__meta';
          meta.textContent = [event.source, event.subjectId ? `id ${event.subjectId}` : ''].filter(Boolean).join(' · ');
          item.append(meta);
        }

        list.append(item);
      }
    };

    render();
    element.replaceChildren(list);

    state.subscribe(render);
  });
}
