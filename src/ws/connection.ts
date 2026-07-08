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
type WebRtcSignal = Extract<PhoenixIncomingMessage, { type: 'webrtc.offer' | 'webrtc.answer' | 'webrtc.ice-candidate' | 'webrtc.state' | 'error' }>;
type WebRtcListener = (message: WebRtcSignal) => void;
type AssetSignal = Extract<PhoenixIncomingMessage, { type: 'asset.changed' | 'section.changed' | 'error' }>;
type AssetListener = (message: AssetSignal) => void;

export interface ConnectionController {
  syncStatusLabel(): void;
  cycleDemoState(): void;
  getRuntimeState(): PhoenixRuntimeState | null;
  isConnected(): boolean;
  send(command: PhoenixTransportCommand): boolean;
  subscribeAssets(listener: AssetListener): () => void;
  subscribeRuntime(listener: RuntimeListener): () => void;
  subscribeWebRtc(listener: WebRtcListener): () => void;
}

export function createConnectionController(state: AppState): ConnectionController {
  let socket: WebSocket | null = null;
  let runtimeState: PhoenixRuntimeState | null = null;
  let reconnectTimer: number | null = null;
  const runtimeListeners = new Set<RuntimeListener>();
  const webRtcListeners = new Set<WebRtcListener>();
  const assetListeners = new Set<AssetListener>();

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

  function publishAsset(message: AssetSignal): void {
    for (const listener of assetListeners) {
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
    state.setConnection('connecting', 'Phoenix disconnected');

    try {
      socket = new WebSocket(PHOENIX_WS_URL);
    } catch (err) {
      state.setConnection('error', 'Phoenix connection error', err instanceof Error ? err.message : String(err));
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      state.setConnection('connecting', 'Phoenix runtime pending');
    });

    socket.addEventListener('message', (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const message = normalizePhoenixMessage(parsed);
      if (!message) {
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

      if (message.type === 'asset.changed' || message.type === 'section.changed') {
        publishAsset(message);
        return;
      }

      publishAsset(message);
      publishWebRtc(message);
    });

    socket.addEventListener('close', () => {
      socket = null;
      runtimeState = null;
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

    subscribeAssets(listener: AssetListener): () => void {
      assetListeners.add(listener);

      return () => {
        assetListeners.delete(listener);
      };
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
