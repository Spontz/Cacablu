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
