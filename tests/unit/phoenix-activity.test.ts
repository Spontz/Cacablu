import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  notifyPhoenixActivity,
  phoenixFetch,
  subscribePhoenixActivity,
} from '../../src/phoenix/activity';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phoenix activity', () => {
  it('publishes activity until a subscriber is removed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePhoenixActivity(listener);

    notifyPhoenixActivity();
    unsubscribe();
    notifyPhoenixActivity();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('publishes request start and successful completion', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePhoenixActivity(listener);
    const response = new Response('{}', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(phoenixFetch('http://127.0.0.1:29100/api/test')).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('publishes request completion when fetch fails', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePhoenixActivity(listener);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(phoenixFetch('http://127.0.0.1:29100/api/test')).rejects.toThrow('offline');

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
