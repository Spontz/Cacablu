import type { ResourceSelection } from '../app/types';
import type { DbBar, ProjectDatabase } from '../db/db-schema';
import type { PhoenixSectionClient } from '../phoenix/section-client';
import {
  ProjectSectionSyncError,
  syncProjectBarToPhoenix,
  type ProjectSectionSyncIssue,
} from './project-section-sync';
import { getSelectedExistingBars } from './bar-enable-toggle';

type BarDeletionSessionLike = {
  data: Pick<ProjectDatabase, 'bars'>;
  deleteTimelineBars(ids: number[]): DbBar[];
  restoreTimelineBars(bars: DbBar[]): DbBar[];
};

type ConnectionLike = {
  isConnected(): boolean;
};

export type BarDeletionSyncClient = Pick<PhoenixSectionClient, 'deleteMany' | 'replaceOne'>;

export interface BarDeletionResult {
  deletedBars: DbBar[];
  deletedIds: number[];
}

export interface BarRestorationSyncResult {
  issues: ProjectSectionSyncIssue[];
  restoredIds: number[];
}

export function isBarDeletionShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return (
    (event.key === 'Delete' || event.key === 'Backspace')
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
  );
}

export function isBarDeletionEditingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean((target as Element).closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], .monaco-editor',
  ));
}

export function deleteSelectedTimelineBars(
  session: Pick<BarDeletionSessionLike, 'data' | 'deleteTimelineBars'>,
  selection: ResourceSelection,
): BarDeletionResult {
  const selectedBars = getSelectedExistingBars(session.data, selection);
  if (selectedBars.length === 0) return { deletedBars: [], deletedIds: [] };

  const deletedBars = session
    .deleteTimelineBars(selectedBars.map((bar) => bar.id))
    .sort((left, right) => left.id - right.id);
  return {
    deletedBars: deletedBars.map((bar) => ({ ...bar })),
    deletedIds: deletedBars.map((bar) => bar.id),
  };
}

export function restoreDeletedTimelineBars(
  session: Pick<BarDeletionSessionLike, 'restoreTimelineBars'>,
  deletedBars: DbBar[],
): DbBar[] {
  return session.restoreTimelineBars(deletedBars.map((bar) => ({ ...bar })));
}

export async function syncDeletedTimelineBarsToPhoenix(
  barIds: number[],
  connection: ConnectionLike,
  client: Pick<BarDeletionSyncClient, 'deleteMany'>,
): Promise<number[]> {
  if (!connection.isConnected() || barIds.length === 0) return [];
  await client.deleteMany(barIds.map(String));
  return [...barIds];
}

export async function syncRestoredTimelineBarsToPhoenix(
  db: Pick<ProjectDatabase, 'bars'>,
  barIds: number[],
  connection: ConnectionLike,
  client: Pick<BarDeletionSyncClient, 'replaceOne'>,
): Promise<BarRestorationSyncResult> {
  if (!connection.isConnected() || barIds.length === 0) {
    return { issues: [], restoredIds: [] };
  }

  const issues: ProjectSectionSyncIssue[] = [];
  const restoredIds: number[] = [];
  for (const barId of barIds) {
    try {
      const result = await syncProjectBarToPhoenix(db, barId, client);
      issues.push(...result.issues);
      if (result.replaced) restoredIds.push(barId);
    } catch (error) {
      if (error instanceof ProjectSectionSyncError) {
        issues.push(...error.issues);
        continue;
      }
      throw error;
    }
  }
  return { issues, restoredIds };
}
