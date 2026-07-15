import type { ResourceClipboardMutation } from '../db/db-session';
import type { PhoenixAssetClient } from '../phoenix/asset-client';
import { addAssetImpactEvents } from '../phoenix/asset-impact-events';
import { deleteAllowedAssetFile, writeAllowedAssetFile } from '../phoenix/asset-operations';
import type { AppState } from '../state/app-state';

export interface ResourceClipboardSyncOptions {
  beforeDelete?: () => Promise<boolean>;
}

export async function syncResourceClipboardMutation(
  result: ResourceClipboardMutation,
  client: Pick<PhoenixAssetClient, 'writeFile' | 'deleteFile'>,
  state: AppState,
  connected: boolean,
  options: ResourceClipboardSyncOptions = {},
): Promise<void> {
  if (!connected) return;
  const destinationPaths = new Set(result.files.map((entry) => entry.newPath.toLocaleLowerCase()));
  const writtenFileIds = new Set<number>();
  let destinationWriteFailed = false;

  for (const entry of result.files) {
    if (!entry.file.enabled) continue;
    try {
      addAssetImpactEvents(
        state,
        await writeAllowedAssetFile(client, entry.newPath, new Uint8Array(entry.file.data), { reloadSections: false }),
        `${result.operation === 'copy' ? 'Copied' : 'Moved'} ${entry.file.name}`,
      );
      writtenFileIds.add(entry.file.id);
    } catch (error) {
      destinationWriteFailed = true;
      recordDiscrepancy(state, `Project updated, but Phoenix could not write ${entry.newPath}`, error);
    }
  }

  if (result.operation !== 'move') return;
  if (destinationWriteFailed) return;
  if (options.beforeDelete) {
    try {
      if (!await options.beforeDelete()) return;
    } catch (error) {
      recordDiscrepancy(state, 'Project updated, but Phoenix could not reload the affected sections', error);
      return;
    }
  }
  for (const entry of result.files) {
    if (!entry.file.enabled || !writtenFileIds.has(entry.file.id) || !entry.oldPath || entry.oldPath === entry.newPath) continue;
    if (destinationPaths.has(entry.oldPath.toLocaleLowerCase())) continue;
    try {
      addAssetImpactEvents(state, await deleteAllowedAssetFile(client, entry.oldPath), `Moved ${entry.file.name}`);
    } catch (error) {
      recordDiscrepancy(state, `Project updated, but Phoenix could not delete ${entry.oldPath}`, error);
    }
  }
}

function recordDiscrepancy(state: AppState, context: string, error: unknown): void {
  state.addEvent({
    severity: 'warning',
    source: 'Pool clipboard',
    description: `${context}: ${error instanceof Error ? error.message : 'unknown error'}`,
  });
}
