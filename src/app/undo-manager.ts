export interface UndoableAction {
  label: string;
  undo(): void | Promise<void>;
}

type Listener = () => void;

export interface UndoManager {
  canUndo(): boolean;
  push(action: UndoableAction): void;
  undo(): Promise<boolean>;
  clear(): void;
  subscribe(listener: Listener): () => void;
}

export function createUndoManager(): UndoManager {
  const stack: UndoableAction[] = [];
  const listeners = new Set<Listener>();

  function publish(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    canUndo(): boolean {
      return stack.length > 0;
    },

    push(action): void {
      stack.push(action);
      publish();
    },

    async undo(): Promise<boolean> {
      const action = stack.pop();
      if (!action) return false;
      publish();
      await action.undo();
      return true;
    },

    clear(): void {
      if (stack.length === 0) return;
      stack.length = 0;
      publish();
    },

    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
