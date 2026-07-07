import type { AppState } from '../state/app-state';
import type { AssetImpactSection, AssetOperationResult } from './asset-client';

const SOURCE = 'Phoenix asset impact';

export function addAssetImpactEvents(state: AppState, result: AssetOperationResult, context: string): void {
  state.markSectionErrors([
    ...(result.failedSections ?? []).map((section) => Number(section.id)),
    ...(result.deactivatedSections ?? []).map((section) => Number(section.id)),
  ].filter((id) => Number.isInteger(id)));
  const events = [
    ...(result.failedSections ?? []).map((section) => toEvent('error' as const, section, `${context}: section ${section.id} failed`, result)),
    ...(result.deactivatedSections ?? []).map((section) => toEvent('error' as const, section, `${context}: section ${section.id} deactivated`, result)),
    ...(result.reloadedSections ?? []).map((section) => toEvent('info' as const, section, `${context}: section ${section.id} reloaded`, result)),
  ];
  state.addEvents(events);
}

function toEvent(
  severity: 'info' | 'warning' | 'error',
  section: AssetImpactSection,
  fallback: string,
  result: AssetOperationResult,
) {
  const details = [
    fallback,
    section.type ? `type ${section.type}` : '',
    result.path ? `asset ${result.path}` : '',
    section.message ?? '',
  ].filter(Boolean).join('. ');

  return {
    severity,
    source: SOURCE,
    subjectId: section.id,
    description: details,
  };
}
