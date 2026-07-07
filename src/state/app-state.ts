import type { AppEvent, AppSnapshot, ConnectionStatus, ResourceSelection } from '../app/types';

type Listener = (snapshot: AppSnapshot) => void;

export interface AppState {
  getSnapshot(): AppSnapshot;
  subscribe(listener: Listener): () => void;
  setActivePanel(panelId: string | null): void;
  setConnection(status: ConnectionStatus, label: string, error?: string | null): void;
  setResourceSelection(selection: ResourceSelection): void;
  clearResourceSelection(): void;
  setDisplayTimelineIds(display: boolean): void;
  toggleDisplayTimelineIds(): void;
  addEvent(event: Omit<AppEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): void;
  addEvents(events: Array<Omit<AppEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }>): void;
  markSectionErrors(ids: number[]): void;
  clearSectionErrors(ids: number[]): void;
  resetSectionErrors(): void;
  clearEventsForSubjects(subjectIds: string[], sources?: string[]): void;
  markEventsRead(): void;
  clearEvents(): void;
}

const INITIAL_SNAPSHOT: AppSnapshot = {
  activePanelId: 'preview',
  connectionStatus: 'disconnected',
  connectionLabel: 'Engine disconnected',
  lastError: null,
  resourceSelection: { kind: 'none' },
  events: [],
  unreadEventCount: 0,
  displayTimelineIds: false,
  sectionErrorIds: [],
};

export function createAppState(): AppState {
  let snapshot: AppSnapshot = { ...INITIAL_SNAPSHOT };
  const listeners = new Set<Listener>();

  function publish(): void {
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    getSnapshot(): AppSnapshot {
      return snapshot;
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      listener(snapshot);

      return () => {
        listeners.delete(listener);
      };
    },

    setActivePanel(panelId: string | null): void {
      snapshot = {
        ...snapshot,
        activePanelId: panelId,
      };
      publish();
    },

    setConnection(status: ConnectionStatus, label: string, error = null): void {
      if (
        snapshot.connectionStatus === status
        && snapshot.connectionLabel === label
        && snapshot.lastError === error
      ) {
        return;
      }

      snapshot = {
        ...snapshot,
        connectionStatus: status,
        connectionLabel: label,
        lastError: error,
      };
      publish();
    },

    setResourceSelection(selection: ResourceSelection): void {
      snapshot = {
        ...snapshot,
        resourceSelection: selection,
      };
      publish();
    },

    clearResourceSelection(): void {
      snapshot = {
        ...snapshot,
        resourceSelection: { kind: 'none' },
      };
      publish();
    },

    setDisplayTimelineIds(display): void {
      if (snapshot.displayTimelineIds === display) return;
      snapshot = {
        ...snapshot,
        displayTimelineIds: display,
      };
      publish();
    },

    toggleDisplayTimelineIds(): void {
      this.setDisplayTimelineIds(!snapshot.displayTimelineIds);
    },

    addEvent(event): void {
      this.addEvents([event]);
    },

    addEvents(events): void {
      if (events.length === 0) return;
      const now = Date.now();
      const nextEvents = events.map((event, index) => ({
        ...event,
        id: event.id ?? `event-${now.toString(36)}-${index}`,
        timestamp: event.timestamp ?? now,
      }));
      snapshot = {
        ...snapshot,
        events: [...nextEvents, ...snapshot.events].slice(0, 200),
        unreadEventCount: snapshot.unreadEventCount + nextEvents.length,
      };
      publish();
    },

    markSectionErrors(ids): void {
      const nextIds = ids.filter((id) => Number.isInteger(id));
      if (nextIds.length === 0) return;
      const merged = new Set([...snapshot.sectionErrorIds, ...nextIds]);
      const sectionErrorIds = [...merged].sort((a, b) => a - b);
      if (
        sectionErrorIds.length === snapshot.sectionErrorIds.length
        && sectionErrorIds.every((id, index) => id === snapshot.sectionErrorIds[index])
      ) {
        return;
      }
      snapshot = {
        ...snapshot,
        sectionErrorIds,
      };
      publish();
    },

    clearSectionErrors(ids): void {
      if (ids.length === 0 || snapshot.sectionErrorIds.length === 0) return;
      const clearIds = new Set(ids);
      const sectionErrorIds = snapshot.sectionErrorIds.filter((id) => !clearIds.has(id));
      if (sectionErrorIds.length === snapshot.sectionErrorIds.length) return;
      snapshot = {
        ...snapshot,
        sectionErrorIds,
      };
      publish();
    },

    resetSectionErrors(): void {
      if (snapshot.sectionErrorIds.length === 0) return;
      snapshot = {
        ...snapshot,
        sectionErrorIds: [],
      };
      publish();
    },

    clearEventsForSubjects(subjectIds, sources): void {
      if (subjectIds.length === 0 || snapshot.events.length === 0) return;
      const subjects = new Set(subjectIds);
      const sourceSet = sources ? new Set(sources) : null;
      const nextEvents = snapshot.events.filter((event) => (
        !event.subjectId
        || !subjects.has(event.subjectId)
        || (sourceSet !== null && (!event.source || !sourceSet.has(event.source)))
      ));
      if (nextEvents.length === snapshot.events.length) return;
      const removed = snapshot.events.length - nextEvents.length;
      snapshot = {
        ...snapshot,
        events: nextEvents,
        unreadEventCount: Math.max(0, snapshot.unreadEventCount - removed),
      };
      publish();
    },

    markEventsRead(): void {
      if (snapshot.unreadEventCount === 0) return;
      snapshot = {
        ...snapshot,
        unreadEventCount: 0,
      };
      publish();
    },

    clearEvents(): void {
      if (snapshot.events.length === 0 && snapshot.unreadEventCount === 0) return;
      snapshot = {
        ...snapshot,
        events: [],
        unreadEventCount: 0,
      };
      publish();
    },
  };
}
