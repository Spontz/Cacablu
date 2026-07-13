type PhoenixActivityListener = () => void;

const listeners = new Set<PhoenixActivityListener>();

export function notifyPhoenixActivity(): void {
  for (const listener of listeners) listener();
}

export function subscribePhoenixActivity(listener: PhoenixActivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function phoenixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  notifyPhoenixActivity();
  try {
    return await fetch(input, init);
  } finally {
    notifyPhoenixActivity();
  }
}
