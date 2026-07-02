export type AssetRoot = 'pool' | 'resources';

export interface NormalizedAssetPath {
  path: string;
  root: AssetRoot;
}

export function normalizeAssetPath(input: string): NormalizedAssetPath | null {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    return null;
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    return null;
  }

  const root = parts[0];
  if (root !== 'pool' && root !== 'resources') {
    return null;
  }

  return {
    path: parts.join('/'),
    root,
  };
}

export function isAllowedAssetPath(input: string): boolean {
  return normalizeAssetPath(input) !== null;
}
