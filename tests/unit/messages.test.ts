import { describe, expect, it } from 'vitest';

import { normalizeEngineMessage, normalizePhoenixMessage } from '../../src/ws/messages';

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

describe('normalizePhoenixMessage', () => {
  it('accepts WebRTC answers without a session id from Phoenix', () => {
    expect(normalizePhoenixMessage({
      type: 'webrtc.answer',
      sdp: 'v=0',
    })).toEqual({
      type: 'webrtc.answer',
      sessionId: undefined,
      sdp: 'v=0',
    });
  });

  it('normalizes Phoenix asset change events', () => {
    expect(normalizePhoenixMessage({
      type: 'asset.changed',
      requestId: 'req-1',
      operation: 'write-file',
      path: 'pool/example.txt',
      entry: { path: 'pool/example.txt', kind: 'file' },
    })).toEqual({
      type: 'asset.changed',
      requestId: 'req-1',
      operation: 'write-file',
      path: 'pool/example.txt',
      entry: { path: 'pool/example.txt', kind: 'file' },
    });
  });

  it('normalizes Phoenix section change events', () => {
    expect(normalizePhoenixMessage({
      type: 'section.changed',
      requestId: 'sections-test',
      operation: 'replace-all',
      count: 2,
    })).toEqual({
      type: 'section.changed',
      requestId: 'sections-test',
      operation: 'replace-all',
      count: 2,
    });
  });
});
