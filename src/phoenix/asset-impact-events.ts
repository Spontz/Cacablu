import type { AppState } from '../state/app-state';
import type { AssetOperationResult } from './asset-client';
import type { PhoenixLogClient } from './log-client';
import { PHOENIX_LOG_EVENT_SOURCE, primePhoenixLogEvents, recordPhoenixLogsAsEvents } from './log-events';

const PHOENIX_ASSET_EVENT_SOURCE = 'Phoenix asset impact';

export function addAssetImpactEvents(state: AppState, result: AssetOperationResult, context: string): void {
  const failedSections = result.failedSections ?? [];
  const deactivatedSections = result.deactivatedSections ?? [];
  const affectedSections = [...failedSections, ...deactivatedSections];
  const unresolvedIds = new Set(affectedSections.map((section) => section.id));
  const reloadedIds = (result.reloadedSections ?? [])
    .filter((section) => !unresolvedIds.has(section.id))
    .map((section) => Number(section.id))
    .filter((id) => Number.isInteger(id));

  state.clearSectionErrors(reloadedIds);
  state.clearEventsForSubjects(
    reloadedIds.map(String),
    [PHOENIX_ASSET_EVENT_SOURCE, PHOENIX_LOG_EVENT_SOURCE],
  );

  state.markSectionErrors(affectedSections
    .map((section) => Number(section.id))
    .filter((id) => Number.isInteger(id)));

  state.addEvents([
    ...failedSections.map((section) => ({
      severity: 'error' as const,
      source: PHOENIX_ASSET_EVENT_SOURCE,
      subjectId: section.id,
      description: `${context}: ${section.message ?? `Section ${section.id} could not be reloaded.`}`,
    })),
    ...deactivatedSections.map((section) => ({
      severity: 'warning' as const,
      source: PHOENIX_ASSET_EVENT_SOURCE,
      subjectId: section.id,
      description: `${context}: ${section.message ?? `Section ${section.id} was deactivated.`}`,
    })),
  ]);
}

export async function runAssetOperationWithEvents(
  state: AppState,
  logs: PhoenixLogClient,
  context: string,
  operation: () => Promise<AssetOperationResult>,
): Promise<AssetOperationResult> {
  await primePhoenixLogEvents(logs);

  try {
    const result = await operation();
    addAssetImpactEvents(state, result, context);
    return result;
  } finally {
    const logResult = await recordPhoenixLogsAsEvents(state, logs);
    state.markSectionErrors(logResult.errorSubjectIds);
  }
}
