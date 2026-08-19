import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPhoenixRuntimeLoopClient } from '../../src/phoenix/runtime-loop-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phoenix runtime loop client', () => {
  it('clears the active runtime loop with DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createPhoenixRuntimeLoopClient('http://phoenix.test/');
    await expect(client.clearLoop()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith('http://phoenix.test/api/runtime/loop', {
      method: 'DELETE',
      signal: undefined,
    });
  });

  it('rejects an unsuccessful clear response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"No loop"}', {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(createPhoenixRuntimeLoopClient().clearLoop()).rejects.toThrow('No loop');
  });
});
