import type { AppSnapshot, ConnectionStatus } from '../app/types';

type Listener = (snapshot: AppSnapshot) => void;

export interface AppState {
  getSnapshot(): AppSnapshot;
  subscribe(listener: Listener): () => void;
  setActivePanel(panelId: string | null): void;
  setConnection(status: ConnectionStatus, label: string, error?: string | null): void;
}

const INITIAL_SNAPSHOT: AppSnapshot = {
  activePanelId: 'preview',
  connectionStatus: 'disconnected',
  connectionLabel: 'Engine disconnected',
  lastError: null,
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
      snapshot = {
        ...snapshot,
        connectionStatus: status,
        connectionLabel: label,
        lastError: error,
      };
      publish();
    },
  };
}
