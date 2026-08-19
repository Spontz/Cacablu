export type CamPhoenixSaveAction = 'local-only' | 'warn-offline' | 'sync';

export function isCamAssetName(name: string): boolean {
  return name.toLowerCase().endsWith('.cam');
}

export function getCamPhoenixSaveAction(enabled: boolean, connected: boolean): CamPhoenixSaveAction {
  if (!enabled) return 'local-only';
  return connected ? 'sync' : 'warn-offline';
}
