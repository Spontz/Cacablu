import type { ResourceSelection } from './types';

export function getResourceSelectionSignature(selection: ResourceSelection): string {
  if (selection.kind === 'bar') return `bar:${selection.id}`;
  if (selection.kind === 'bars') return `bars:${[...selection.ids].sort((a, b) => a - b).join(',')}`;
  return 'none';
}
