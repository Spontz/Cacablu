import type { DbFile, DbFolder, ProjectDatabase } from '../db/db-schema';
import type { PhoenixAssetClient } from '../phoenix/asset-client';
import { addAssetImpactEvents } from '../phoenix/asset-impact-events';
import { writeAllowedAssetFile } from '../phoenix/asset-operations';
import type { PhoenixSectionClient } from '../phoenix/section-client';
import type { AppState } from '../state/app-state';
import { ProjectSectionSyncError, syncProjectBarToPhoenix } from './project-section-sync';

export type ResourceImportConflict =
  | { kind: 'file'; file: DbFile }
  | { kind: 'folder'; folder: DbFolder };

export interface ImportedResourceSyncResult {
  written: boolean;
  syncedBarIds: number[];
  failedBarIds: number[];
}

export function findResourceImportConflict(
  db: Pick<ProjectDatabase, 'files' | 'folders'>,
  parentId: number,
  name: string,
): ResourceImportConflict | null {
  const key = name.toLocaleLowerCase();
  const file = db.files.find((candidate) => (
    candidate.parent === parentId && candidate.name.toLocaleLowerCase() === key
  ));
  if (file) return { kind: 'file', file };

  const folder = db.folders.find((candidate) => (
    candidate.parent === parentId && candidate.name.toLocaleLowerCase() === key
  ));
  return folder ? { kind: 'folder', folder } : null;
}

export async function syncImportedResourceFileToPhoenix(
  db: ProjectDatabase,
  file: DbFile,
  path: string,
  referencedBarIds: number[],
  assetClient: Pick<PhoenixAssetClient, 'writeFile'>,
  sectionClient: Pick<PhoenixSectionClient, 'replaceOne'>,
  state: AppState,
  connected: boolean,
): Promise<ImportedResourceSyncResult> {
  if (!connected || !file.enabled) {
    return { written: false, syncedBarIds: [], failedBarIds: [] };
  }

  const writeResult = await writeAllowedAssetFile(
    assetClient,
    path,
    new Uint8Array(file.data),
    { reloadSections: false },
  );
  addAssetImpactEvents(state, writeResult, `Imported ${file.name}`);
  if (!writeResult.ok) {
    throw new Error(writeResult.message ?? `Phoenix could not replace ${path}.`);
  }

  const syncedBarIds: number[] = [];
  const failedBarIds: number[] = [];
  for (const barId of [...new Set(referencedBarIds)]) {
    try {
      const result = await syncProjectBarToPhoenix(db, barId, sectionClient);
      if (result.issues.length > 0 || !result.replaced) {
        failedBarIds.push(barId);
        state.markSectionErrors([barId]);
        for (const issue of result.issues) {
          state.addEvent({
            severity: 'error',
            source: 'Phoenix section sync',
            subjectId: String(issue.barId),
            description: issue.description,
          });
        }
        continue;
      }

      syncedBarIds.push(barId);
      state.clearSectionErrors([barId]);
      state.clearEventsForSubjects(
        [String(barId)],
        ['Phoenix section sync', 'Phoenix asset impact', 'Phoenix log'],
      );
    } catch (error) {
      const issues = error instanceof ProjectSectionSyncError ? error.issues : [];
      failedBarIds.push(barId);
      state.markSectionErrors(issues.length > 0 ? issues.map((issue) => issue.barId) : [barId]);
      state.addEvent({
        severity: 'error',
        source: 'Phoenix section sync',
        subjectId: String(barId),
        description: error instanceof Error
          ? error.message
          : `Could not update section ${barId} after importing ${file.name}.`,
      });
    }
  }

  return { written: true, syncedBarIds, failedBarIds };
}
