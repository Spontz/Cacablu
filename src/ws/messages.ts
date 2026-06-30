import type { EngineMessageType } from '../app/types';

export interface EngineMessageEnvelope {
  type: EngineMessageType;
  timestamp: number;
  payload: unknown;
}

const VALID_MESSAGE_TYPES = new Set<EngineMessageType>([
  'status',
  'resource',
  'timeline',
  'event',
]);

export function isEngineMessageType(value: string): value is EngineMessageType {
  return VALID_MESSAGE_TYPES.has(value as EngineMessageType);
}

export function normalizeEngineMessage(input: unknown): EngineMessageEnvelope | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.type !== 'string' || !isEngineMessageType(candidate.type)) {
    return null;
  }

  return {
    type: candidate.type,
    timestamp: typeof candidate.timestamp === 'number' ? candidate.timestamp : Date.now(),
    payload: candidate.payload ?? null,
  };
}

export interface PhoenixRuntimeState {
  time: number;
  playing: boolean | null;
  fps: number | null;
  startTime: number | null;
  endTime: number | null;
  receivedAt: number;
}

export type PhoenixIncomingMessage =
  | {
      type: 'runtime.state';
      state: PhoenixRuntimeState;
    }
  | {
      type: 'webrtc.answer';
      sessionId: number;
      sdp: string;
    }
  | {
      type: 'webrtc.offer';
      sessionId: number;
      sdp: string;
    }
  | {
      type: 'webrtc.ice-candidate';
      sessionId?: number;
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    }
  | {
      type: 'webrtc.state';
      state: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    };

export type PhoenixTransportCommand =
  | {
      type: 'runtime.play';
    }
  | {
      type: 'runtime.pause';
    }
  | {
      type: 'runtime.toggle';
    }
  | {
      type: 'runtime.seek';
      time: number;
    }
  | {
      type: 'input.mouse.move';
      x: number;
      y: number;
    }
  | {
      type: 'input.mouse.down';
      x: number;
      y: number;
      button: number;
    }
  | {
      type: 'input.mouse.up';
      x: number;
      y: number;
      button: number;
    }
  | {
      type: 'input.mouse.wheel';
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    }
  | {
      type: 'input.key.down';
      key: number;
      scancode: number;
      mods: number;
      repeat: boolean;
    }
  | {
      type: 'input.key.up';
      key: number;
      scancode: number;
      mods: number;
    }
  | {
      type: 'webrtc.offer';
      sdp: string;
    }
  | {
      type: 'webrtc.request';
    }
  | {
      type: 'webrtc.answer';
      sessionId: number;
      sdp: string;
    }
  | {
      type: 'webrtc.ice-candidate';
      sessionId: number;
      candidate: string;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
    };

export function normalizePhoenixMessage(input: unknown): PhoenixIncomingMessage | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  if (candidate.type === 'runtime.state') {
    if (typeof candidate.time !== 'number' || !Number.isFinite(candidate.time)) {
      return null;
    }

    return {
      type: 'runtime.state',
      state: {
        time: Math.max(candidate.time, 0),
        playing: typeof candidate.playing === 'boolean' ? candidate.playing : null,
        fps: finiteOrNull(candidate.fps),
        startTime: finiteOrNull(candidate.startTime),
        endTime: finiteOrNull(candidate.endTime),
        receivedAt: Date.now(),
      },
    };
  }

  if (candidate.type === 'error') {
    return {
      type: 'error',
      code: typeof candidate.code === 'string' ? candidate.code : 'unknown',
      message: typeof candidate.message === 'string' ? candidate.message : 'Unknown Phoenix error',
    };
  }

  if (candidate.type === 'webrtc.answer') {
    return typeof candidate.sdp === 'string' && typeof candidate.sessionId === 'number'
      ? {
          type: 'webrtc.answer',
          sessionId: candidate.sessionId,
          sdp: candidate.sdp,
        }
      : null;
  }

  if (candidate.type === 'webrtc.offer') {
    return typeof candidate.sdp === 'string' && typeof candidate.sessionId === 'number'
      ? {
          type: 'webrtc.offer',
          sessionId: candidate.sessionId,
          sdp: candidate.sdp,
        }
      : null;
  }

  if (candidate.type === 'webrtc.ice-candidate') {
    return typeof candidate.candidate === 'string'
      ? {
          type: 'webrtc.ice-candidate',
          sessionId: typeof candidate.sessionId === 'number' ? candidate.sessionId : undefined,
          candidate: candidate.candidate,
          sdpMid: typeof candidate.sdpMid === 'string' ? candidate.sdpMid : null,
          sdpMLineIndex: typeof candidate.sdpMLineIndex === 'number' ? candidate.sdpMLineIndex : null,
        }
      : null;
  }

  if (candidate.type === 'webrtc.state') {
    return typeof candidate.state === 'string'
      ? {
          type: 'webrtc.state',
          state: candidate.state,
        }
      : null;
  }

  return null;
}

export function createPhoenixCommand(command: PhoenixTransportCommand): string {
  return JSON.stringify(command);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
