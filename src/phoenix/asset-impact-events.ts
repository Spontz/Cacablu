import type { AppState } from '../state/app-state';
import type { AssetOperationResult } from './asset-client';

export function addAssetImpactEvents(state: AppState, result: AssetOperationResult, context: string): void {
  void context;
  state.markSectionErrors([
    ...(result.failedSections ?? []).map((section) => Number(section.id)),
    ...(result.deactivatedSections ?? []).map((section) => Number(section.id)),
  ].filter((id) => Number.isInteger(id)));
}
