export type DbStatus = 'none' | 'opening' | 'open' | 'saving' | 'error';

export interface DbSnapshot {
  status: DbStatus;
  fileName: string | null;
  isDirty: boolean;
  lastError: string | null;
}

type Listener = (snapshot: DbSnapshot) => void;

export interface DbState {
  getSnapshot(): DbSnapshot;
  subscribe(listener: Listener): () => void;
  setOpening(): void;
  setOpen(fileName: string): void;
  setSaving(): void;
  setSaved(): void;
  setDirty(): void;
  setError(message: string): void;
  clear(): void;
}

const INITIAL: DbSnapshot = {
  status: 'none',
  fileName: null,
  isDirty: false,
  lastError: null,
};

export function createDbState(): DbState {
  let snapshot: DbSnapshot = { ...INITIAL };
  const listeners = new Set<Listener>();

  function publish(): void {
    for (const listener of listeners) listener(snapshot);
  }

  function patch(changes: Partial<DbSnapshot>): void {
    snapshot = { ...snapshot, ...changes };
    publish();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      listener(snapshot);
      return () => { listeners.delete(listener); };
    },

    setOpening: () => patch({ status: 'opening', lastError: null }),
    setOpen: (fileName) => patch({ status: 'open', fileName, isDirty: false, lastError: null }),
    setSaving: () => patch({ status: 'saving', lastError: null }),
    setSaved: () => patch({ status: 'open', isDirty: false, lastError: null }),
    setDirty: () => patch({ isDirty: true }),
    setError: (message) => patch({ status: 'open', lastError: message }),
    clear: () => patch({ ...INITIAL }),
  };
}
