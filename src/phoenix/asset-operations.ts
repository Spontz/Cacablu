import type { PhoenixAssetClient, AssetOperationResult, AssetWriteOptions } from './asset-client';
import { normalizeAssetPath } from './asset-paths';

export async function writeAllowedAssetFile(
  client: Pick<PhoenixAssetClient, 'writeFile'>,
  path: string,
  bytes: Uint8Array,
  options?: AssetWriteOptions,
): Promise<AssetOperationResult> {
  const normalized = normalizeAssetPath(path);
  if (!normalized) {
    throw new Error('Asset path must be under pool or resources.');
  }

  return options
    ? client.writeFile(normalized.path, bytes, undefined, options)
    : client.writeFile(normalized.path, bytes);
}

export async function deleteAllowedAssetFile(
  client: Pick<PhoenixAssetClient, 'deleteFile'>,
  path: string,
): Promise<AssetOperationResult> {
  const normalized = normalizeAssetPath(path);
  if (!normalized) {
    throw new Error('Asset path must be under pool or resources.');
  }

  return client.deleteFile(normalized.path);
}

export async function deleteAllowedAssetDirectory(
  client: Pick<PhoenixAssetClient, 'deleteDirectory'>,
  path: string,
  recursive: boolean,
): Promise<AssetOperationResult> {
  const normalized = normalizeAssetPath(path);
  if (!normalized) {
    throw new Error('Asset path must be under pool or resources.');
  }

  return client.deleteDirectory(normalized.path, recursive);
}
