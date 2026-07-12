import { describe, expect, it, vi } from 'vitest';

import { createProjectSyncCoordinator } from '../../src/services/project-sync-coordinator';

describe('project sync coordinator', () => {
  it('does nothing when Phoenix connects without a project', () => {
    const synchronize = vi.fn();
    const coordinator = createProjectSyncCoordinator(synchronize);

    expect(coordinator.onConnected()).toBeNull();
    expect(synchronize).not.toHaveBeenCalled();
    expect(coordinator.getStatus()).toBe('idle');
  });

  it('runs one synchronization for duplicate connected notifications', async () => {
    const synchronize = vi.fn().mockResolvedValue(undefined);
    const session = { name: 'demo' };
    const coordinator = createProjectSyncCoordinator(synchronize);
    coordinator.setSession(session);

    const first = coordinator.onConnected();
    const duplicate = coordinator.onConnected();
    await Promise.all([first, duplicate]);

    expect(synchronize).toHaveBeenCalledTimes(1);
    expect(synchronize).toHaveBeenCalledWith(session, expect.any(AbortSignal));
    expect(coordinator.getStatus()).toBe('synced');
  });

  it('aborts an in-flight generation on disconnect and retries after reconnect', async () => {
    const signals: AbortSignal[] = [];
    const synchronize = vi.fn((_session: object, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<void>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        if (signals.length === 2) resolve();
      });
    });
    const coordinator = createProjectSyncCoordinator(synchronize);
    coordinator.setSession({ name: 'demo' });

    const stale = coordinator.onConnected();
    coordinator.onDisconnected();
    await stale;
    expect(signals[0].aborted).toBe(true);
    expect(coordinator.getStatus()).toBe('pending');

    await coordinator.onConnected();
    expect(synchronize).toHaveBeenCalledTimes(2);
    expect(coordinator.getStatus()).toBe('synced');
  });

  it('does not let an old project completion synchronize a new project', async () => {
    let finishOld: (() => void) | undefined;
    const synchronize = vi.fn((session: { name: string }, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
      if (session.name === 'old') finishOld = resolve;
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const coordinator = createProjectSyncCoordinator(synchronize);
    coordinator.setSession({ name: 'old' });
    const stale = coordinator.onConnected();

    coordinator.setSession({ name: 'new' });
    finishOld?.();
    await stale;

    expect(coordinator.getStatus()).toBe('pending');
  });

  it('keeps failures pending so a later connection can retry', async () => {
    const onError = vi.fn();
    const synchronize = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const coordinator = createProjectSyncCoordinator(synchronize, onError);
    coordinator.setSession({ name: 'demo' });

    await coordinator.onConnected();
    expect(coordinator.getStatus()).toBe('pending');
    expect(onError).toHaveBeenCalledTimes(1);

    coordinator.onDisconnected();
    await coordinator.onConnected();
    expect(coordinator.getStatus()).toBe('synced');
  });
});
