export type ProjectSyncStatus = 'idle' | 'pending' | 'syncing' | 'synced';

export interface ProjectSyncCoordinator<TSession> {
  setSession(session: TSession | null, synchronized?: boolean): void;
  onConnected(): Promise<void> | null;
  onDisconnected(): void;
  getStatus(): ProjectSyncStatus;
}

export function createProjectSyncCoordinator<TSession>(
  synchronize: (session: TSession, signal: AbortSignal) => Promise<void>,
  onError: (error: unknown) => void = () => {},
): ProjectSyncCoordinator<TSession> {
  let session: TSession | null = null;
  let connected = false;
  let generation = 0;
  let status: ProjectSyncStatus = 'idle';
  let active: { generation: number; controller: AbortController; promise: Promise<void> } | null = null;

  function invalidate(): void {
    generation += 1;
    active?.controller.abort(new DOMException('Project synchronization superseded.', 'AbortError'));
    active = null;
  }

  function setSession(nextSession: TSession | null, synchronized = false): void {
    if (session !== nextSession) invalidate();
    session = nextSession;
    status = nextSession === null ? 'idle' : synchronized ? 'synced' : 'pending';
  }

  function onConnected(): Promise<void> | null {
    if (connected) return active?.promise ?? null;
    connected = true;
    generation += 1;
    if (!session) {
      status = 'idle';
      return null;
    }

    status = 'syncing';
    const syncGeneration = generation;
    const syncSession = session;
    const controller = new AbortController();
    const promise = synchronize(syncSession, controller.signal)
      .then(() => {
        if (connected && generation === syncGeneration && session === syncSession) status = 'synced';
      })
      .catch((error: unknown) => {
        if (generation === syncGeneration && session === syncSession) status = 'pending';
        if (!(error instanceof DOMException && error.name === 'AbortError')) onError(error);
      })
      .finally(() => {
        if (active?.generation === syncGeneration) active = null;
      });
    active = { generation: syncGeneration, controller, promise };
    return promise;
  }

  function onDisconnected(): void {
    if (!connected) return;
    connected = false;
    invalidate();
    status = session ? 'pending' : 'idle';
  }

  return {
    setSession,
    onConnected,
    onDisconnected,
    getStatus: () => status,
  };
}
