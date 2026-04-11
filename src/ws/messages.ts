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
