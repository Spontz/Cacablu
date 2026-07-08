import type { ResourceSelection } from '../app/types';
import type { DbBar, ProjectDatabase } from '../db/db-schema';
import type { PhoenixSectionClient } from '../phoenix/section-client';
import {
  ProjectSectionSyncError,
  syncProjectBarToPhoenix,
  type ProjectSectionSyncIssue,
} from './project-section-sync';

export interface BarEnableSnapshot {
  id: number;
  enabled: boolean;
}

export interface BarEnableToggleResult {
  changed: BarEnableSnapshot[];
  enabledIds: number[];
  disabledIds: number[];
}

export interface BarEnableSyncResult {
  issues: ProjectSectionSyncIssue[];
  deletedIds: number[];
  enabledIds: number[];
}

type ConnectionLike = {
  isConnected(): boolean;
};

type BarEnableSessionLike = {
  data: Pick<ProjectDatabase, 'bars'>;
  setTimelineBarEnabled(barId: number, enabled: boolean): DbBar;
};

export type BarEnableSyncClient = Pick<PhoenixSectionClient, 'deleteMany' | 'replaceOne'>;

export function getSelectedExistingBars(
  db: Pick<ProjectDatabase, 'bars'>,
  selection: ResourceSelection,
): DbBar[] {
  if (selection.kind === 'bar') {
    const bar = db.bars.find((candidate) => candidate.id === selection.id);
    return bar ? [bar] : [];
  }

  if (selection.kind === 'bars') {
    const selectedIds = new Set(selection.ids);
    return db.bars
      .filter((bar) => selectedIds.has(bar.id))
      .sort((a, b) => a.id - b.id);
  }

  return [];
}

export function hasSelectedExistingBars(
  db: Pick<ProjectDatabase, 'bars'> | null,
  selection: ResourceSelection,
): boolean {
  return db ? getSelectedExistingBars(db, selection).length > 0 : false;
}

export function toggleSelectedBarEnabledStates(
  session: BarEnableSessionLike,
  selection: ResourceSelection,
): BarEnableToggleResult {
  const bars = getSelectedExistingBars(session.data, selection);
  const changed = bars.map((bar) => ({ id: bar.id, enabled: bar.enabled }));
  const enabledIds: number[] = [];
  const disabledIds: number[] = [];

  for (const bar of bars) {
    const nextEnabled = !bar.enabled;
    session.setTimelineBarEnabled(bar.id, nextEnabled);
    if (nextEnabled) {
      enabledIds.push(bar.id);
    } else {
      disabledIds.push(bar.id);
    }
  }

  return { changed, enabledIds, disabledIds };
}

export function restoreBarEnabledStates(
  session: Pick<BarEnableSessionLike, 'setTimelineBarEnabled'>,
  snapshots: BarEnableSnapshot[],
): BarEnableToggleResult {
  const enabledIds: number[] = [];
  const disabledIds: number[] = [];

  for (const snapshot of snapshots) {
    session.setTimelineBarEnabled(snapshot.id, snapshot.enabled);
    if (snapshot.enabled) {
      enabledIds.push(snapshot.id);
    } else {
      disabledIds.push(snapshot.id);
    }
  }

  return { changed: snapshots, enabledIds, disabledIds };
}

export async function syncBarEnabledChangesToPhoenix(
  db: Pick<ProjectDatabase, 'bars'>,
  changes: Pick<BarEnableToggleResult, 'enabledIds' | 'disabledIds'>,
  connection: ConnectionLike,
  client: BarEnableSyncClient,
): Promise<BarEnableSyncResult> {
  if (!connection.isConnected()) {
    return { issues: [], deletedIds: [], enabledIds: [] };
  }

  const issues: ProjectSectionSyncIssue[] = [];
  const deletedIds: number[] = [];
  const enabledIds: number[] = [];

  if (changes.disabledIds.length > 0) {
    await client.deleteMany(changes.disabledIds.map(String));
    deletedIds.push(...changes.disabledIds);
  }

  for (const barId of changes.enabledIds) {
    try {
      const result = await syncProjectBarToPhoenix(db, barId, client);
      issues.push(...result.issues);
      enabledIds.push(barId);
    } catch (err) {
      if (err instanceof ProjectSectionSyncError) {
        issues.push(...err.issues);
      } else {
        throw err;
      }
    }
  }

  return { issues, deletedIds, enabledIds };
}
