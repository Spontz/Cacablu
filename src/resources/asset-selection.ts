import type { AssetSelection, AssetSelectionItem } from '../app/types';

export function getAssetSelectionItems(selection: AssetSelection): AssetSelectionItem[] {
  if (selection.kind === 'none') return [];
  if (selection.kind === 'multiple') return selection.items;
  return [selection];
}

export function createAssetSelection(items: AssetSelectionItem[]): AssetSelection {
  const unique = deduplicateSelection(items);
  if (unique.length === 0) return { kind: 'none' };
  if (unique.length === 1) return unique[0];
  return { kind: 'multiple', items: unique };
}

export function toggleAssetSelection(selection: AssetSelection, item: AssetSelectionItem): AssetSelection {
  const items = getAssetSelectionItems(selection);
  const key = assetSelectionKey(item);
  const contains = items.some((candidate) => assetSelectionKey(candidate) === key);
  return createAssetSelection(contains
    ? items.filter((candidate) => assetSelectionKey(candidate) !== key)
    : [...items, item]);
}

export function createAssetRangeSelection(
  visibleItems: AssetSelectionItem[],
  anchor: AssetSelectionItem | null,
  target: AssetSelectionItem,
): AssetSelection {
  if (!anchor) return target;
  const anchorIndex = visibleItems.findIndex((item) => assetSelectionKey(item) === assetSelectionKey(anchor));
  const targetIndex = visibleItems.findIndex((item) => assetSelectionKey(item) === assetSelectionKey(target));
  if (anchorIndex < 0 || targetIndex < 0) return target;
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return createAssetSelection(visibleItems.slice(start, end + 1));
}

export function isAssetSelected(selection: AssetSelection, kind: 'file' | 'folder', id: number): boolean {
  return getAssetSelectionItems(selection).some((item) => item.kind === kind && item.id === id);
}

export function assetSelectionKey(item: Pick<AssetSelectionItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`;
}

function deduplicateSelection(items: AssetSelectionItem[]): AssetSelectionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = assetSelectionKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
