import type { IContentRenderer } from 'dockview-core';

import type { AppEvent } from '../app/types';
import type { AppState } from '../state/app-state';
import { createContentRenderer } from './base-panel';

export const EVENT_SELECTION_CHANGED_EVENT = 'cacablu:event-selection-changed';

export interface EventSelectionChangedDetail {
  eventId: string | null;
  text: string | null;
}

export function createEventsPanel(state: AppState): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'events-panel';

    let events: AppEvent[] = [];
    let query = '';
    let selectedEventId: string | null = null;

    const toolbar = document.createElement('div');
    toolbar.className = 'events-panel__toolbar';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'events-panel__search';
    search.placeholder = 'Search events';
    search.setAttribute('aria-label', 'Search events');
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      list.scrollTop = 0;
      renderList();
    });

    const clearAll = document.createElement('button');
    clearAll.type = 'button';
    clearAll.className = 'events-panel__clear';
    clearAll.textContent = 'Clear all';
    clearAll.addEventListener('click', () => {
      state.clearEvents();
    });
    toolbar.append(search, clearAll);

    const list = document.createElement('div');
    list.className = 'events-listbox';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Events');
    list.addEventListener('click', () => {
      state.markEventsRead();
    });

    function render(): void {
      const snapshot = state.getSnapshot();
      events = snapshot.events;
      if (selectedEventId !== null && !events.some((event) => event.id === selectedEventId)) {
        selectedEventId = null;
        publishSelection(null);
      }
      clearAll.disabled = events.length === 0;
      renderList();
    }

    function renderList(): void {
      const filteredEvents = filterEvents(events, query);
      list.innerHTML = '';

      if (events.length === 0 || filteredEvents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'events-listbox__empty';
        empty.setAttribute('role', 'option');
        empty.setAttribute('aria-selected', 'false');
        empty.textContent = events.length === 0 ? 'No events.' : 'No matching events.';
        list.append(empty);
        return;
      }

      for (let index = 0; index < filteredEvents.length; index += 1) {
        const event = filteredEvents[index];
        const item = createEventItem(
          event,
          index,
          filteredEvents.length,
          state,
          event.id === selectedEventId,
          event.id === selectedEventId || (selectedEventId === null && index === 0),
          () => selectEvent(event),
        );
        list.append(item);
      }
    }

    function selectEvent(event: AppEvent): void {
      selectedEventId = event.id;
      if (state.getSnapshot().activePanelId !== 'events') {
        state.setActivePanel('events');
      } else {
        for (const item of list.querySelectorAll<HTMLElement>('.events-listbox__item')) {
          const selected = item.dataset.eventId === event.id;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-selected', String(selected));
          item.tabIndex = selected ? 0 : -1;
        }
      }
      publishSelection(event);
      const selectedItem = Array.from(list.querySelectorAll<HTMLElement>('.events-listbox__item'))
        .find((item) => item.dataset.eventId === event.id);
      const textSelection = window.getSelection();
      if (!textSelection || textSelection.isCollapsed) {
        selectedItem?.focus({ preventScroll: true });
      }
    }

    function publishSelection(event: AppEvent | null): void {
      window.dispatchEvent(new CustomEvent<EventSelectionChangedDetail>(EVENT_SELECTION_CHANGED_EVENT, {
        detail: {
          eventId: event?.id ?? null,
          text: event?.description ?? null,
        },
      }));
    }

    render();
    element.replaceChildren(toolbar, list);

    const unsubscribe = state.subscribe(render);
    return () => {
      unsubscribe();
      publishSelection(null);
    };
  });
}

function filterEvents(events: AppEvent[], query: string): AppEvent[] {
  if (query === '') return events;
  return events.filter((event) => [
    event.severity,
    event.source ?? '',
    event.subjectId ?? '',
    event.description,
  ].join(' ').toLowerCase().includes(query));
}

function createEventItem(
  event: AppEvent,
  index: number,
  total: number,
  state: AppState,
  selected: boolean,
  tabbable: boolean,
  onSelect: () => void,
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'events-listbox__item';
  item.classList.toggle('is-selected', selected);
  item.dataset.eventId = event.id;
  item.dataset.severity = event.severity;
  item.setAttribute('role', 'option');
  item.setAttribute('aria-selected', String(selected));
  item.setAttribute('aria-posinset', String(index + 1));
  item.setAttribute('aria-setsize', String(total));
  item.tabIndex = tabbable ? 0 : -1;
  item.addEventListener('click', onSelect);
  item.addEventListener('keydown', (keyboardEvent) => {
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
    keyboardEvent.preventDefault();
    onSelect();
  });

  const problemBarId = inferProblemBarId(event);
  const severity = problemBarId === null ? document.createElement('span') : document.createElement('button');
  severity.className = 'events-listbox__severity';
  severity.textContent = event.severity;
  if (problemBarId !== null && severity instanceof HTMLButtonElement) {
    severity.type = 'button';
    severity.title = `Select bar ${problemBarId}`;
    severity.setAttribute('aria-label', `Select bar ${problemBarId}`);
    severity.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      onSelect();
      window.dispatchEvent(new CustomEvent('cacablu:open-timeline'));
      state.setResourceSelection({ kind: 'bar', id: problemBarId });
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('cacablu:timeline-reveal-bar', {
          detail: { barId: problemBarId },
        }));
      });
      state.markEventsRead();
    });
  }

  const description = document.createElement('span');
  description.className = 'events-listbox__description';
  description.textContent = event.description;
  description.title = event.description;

  item.append(severity, description);
  if (event.subjectId || event.source) {
    const meta = document.createElement('span');
    meta.className = 'events-listbox__meta';
    meta.textContent = [event.source, event.subjectId ? `id ${event.subjectId}` : ''].filter(Boolean).join(' - ');
    item.append(meta);
  }

  return item;
}

function inferProblemBarId(event: AppEvent): number | null {
  const subjectId = event.subjectId ? Number(event.subjectId) : Number.NaN;
  if (Number.isInteger(subjectId)) return subjectId;

  const description = event.description;
  const patterns = [
    /\[id:\s*(\d+)\b/i,
    /\b[A-Za-z][A-Za-z0-9 _-]*\s+\[(\d+)\]\s*:/,
    /\bSection\s+(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match) continue;
    const id = Number(match[1]);
    if (Number.isInteger(id)) return id;
  }

  return null;
}
