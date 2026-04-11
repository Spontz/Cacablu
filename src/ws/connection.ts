import type { AppState } from '../state/app-state';

const DEMO_CONNECTION_STATES = [
  { status: 'disconnected', label: 'Engine disconnected', error: null },
  { status: 'connecting', label: 'Connecting to local engine...', error: null },
  { status: 'connected', label: 'Engine connected', error: null },
  { status: 'error', label: 'Engine connection error', error: 'Demo connection failure' },
] as const;

export interface ConnectionController {
  syncStatusLabel(): void;
  cycleDemoState(): void;
}

export function createConnectionController(state: AppState): ConnectionController {
  let demoIndex = 0;

  return {
    syncStatusLabel(): void {
      const current = DEMO_CONNECTION_STATES[demoIndex];
      state.setConnection(current.status, current.label, current.error);
    },

    cycleDemoState(): void {
      demoIndex = (demoIndex + 1) % DEMO_CONNECTION_STATES.length;
      const next = DEMO_CONNECTION_STATES[demoIndex];
      state.setConnection(next.status, next.label, next.error);
    },
  };
}
