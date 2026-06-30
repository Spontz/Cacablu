import type { AppState } from '../state/app-state';
import {
  createPhoenixCommand,
  normalizePhoenixMessage,
  type PhoenixIncomingMessage,
  type PhoenixRuntimeState,
  type PhoenixTransportCommand,
} from './messages';

const PHOENIX_WS_URL = 'ws://127.0.0.1:29100/ws';
const RECONNECT_DELAY_MS = 1500;

type RuntimeListener = (state: PhoenixRuntimeState) => void;
type WebRtcSignal = Extract<PhoenixIncomingMessage, { type: 'webrtc.offer' | 'webrtc.answer' | 'webrtc.ice-candidate' | 'webrtc.state' }>;
type WebRtcListener = (message: WebRtcSignal) => void;

export interface ConnectionController {
  syncStatusLabel(): void;
  cycleDemoState(): void;
  getRuntimeState(): PhoenixRuntimeState | null;
  isConnected(): boolean;
  send(command: PhoenixTransportCommand): boolean;
  subscribeRuntime(listener: RuntimeListener): () => void;
  subscribeWebRtc(listener: WebRtcListener): () => void;
}

export function createConnectionController(state: AppState): ConnectionController {
  let socket: WebSocket | null = null;
  let runtimeState: PhoenixRuntimeState | null = null;
  let reconnectTimer: number | null = null;
  const runtimeListeners = new Set<RuntimeListener>();
  const webRtcListeners = new Set<WebRtcListener>();

  function publishRuntime(nextState: PhoenixRuntimeState): void {
    runtimeState = nextState;
    for (const listener of runtimeListeners) {
      listener(nextState);
    }
  }

  function publishWebRtc(message: WebRtcSignal): void {
    for (const listener of webRtcListeners) {
      listener(message);
    }
  }

  function clearReconnect(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }

  function connect(): void {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      return;
    }

    clearReconnect();
    state.setConnection('connecting', 'Connecting to Phoenix...');

    try {
      socket = new WebSocket(PHOENIX_WS_URL);
    } catch (err) {
      state.setConnection('error', 'Phoenix connection error', err instanceof Error ? err.message : String(err));
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      state.setConnection('connected', 'Phoenix connected');
    });

    socket.addEventListener('message', (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        state.setConnection('error', 'Phoenix message error', 'Received malformed JSON from Phoenix.');
        return;
      }

      const message = normalizePhoenixMessage(parsed);
      if (!message) {
        state.setConnection('error', 'Phoenix message error', 'Received unsupported Phoenix message.');
        return;
      }

      if (message.type === 'runtime.state') {
        publishRuntime(message.state);
        if (state.getSnapshot().connectionStatus !== 'connected') {
          state.setConnection('connected', 'Phoenix connected');
        }
        return;
      }

      if (message.type === 'webrtc.offer' || message.type === 'webrtc.answer' || message.type === 'webrtc.ice-candidate' || message.type === 'webrtc.state') {
        publishWebRtc(message);
        return;
      }

      state.setConnection('error', 'Phoenix runtime error', message.message);
    });

    socket.addEventListener('close', () => {
      socket = null;
      state.setConnection('disconnected', 'Phoenix disconnected');
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      state.setConnection('error', 'Phoenix connection error', 'Could not connect to Phoenix.');
    });
  }

  return {
    syncStatusLabel(): void {
      connect();
    },

    cycleDemoState(): void {
      if (socket) {
        socket.close();
        socket = null;
      }
      connect();
    },

    getRuntimeState(): PhoenixRuntimeState | null {
      return runtimeState;
    },

    isConnected(): boolean {
      return socket?.readyState === WebSocket.OPEN;
    },

    send(command: PhoenixTransportCommand): boolean {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }

      socket.send(createPhoenixCommand(command));
      return true;
    },

    subscribeRuntime(listener: RuntimeListener): () => void {
      runtimeListeners.add(listener);
      if (runtimeState) {
        listener(runtimeState);
      }

      return () => {
        runtimeListeners.delete(listener);
      };
    },

    subscribeWebRtc(listener: WebRtcListener): () => void {
      webRtcListeners.add(listener);

      return () => {
        webRtcListeners.delete(listener);
      };
    },
  };
}
