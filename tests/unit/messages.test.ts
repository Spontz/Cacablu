import { describe, expect, it } from 'vitest';

import { normalizeEngineMessage } from '../../src/ws/messages';

describe('normalizeEngineMessage', () => {
  it('normalizes a valid engine message', () => {
    const message = normalizeEngineMessage({
      type: 'timeline',
      timestamp: 42,
      payload: { playhead: 1.2 },
    });

    expect(message).toEqual({
      type: 'timeline',
      timestamp: 42,
      payload: { playhead: 1.2 },
    });
  });

  it('rejects an unknown message type', () => {
    const message = normalizeEngineMessage({
      type: 'unknown',
      payload: {},
    });

    expect(message).toBeNull();
  });
});
