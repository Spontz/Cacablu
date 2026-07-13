import { describe, expect, it } from 'vitest';

import type { AssetSelectionItem } from '../../src/app/types';
import {
  createAssetRangeSelection,
  createAssetSelection,
  getAssetSelectionItems,
  toggleAssetSelection,
} from '../../src/resources/asset-selection';

const folder: AssetSelectionItem = { kind: 'folder', id: 1, name: 'textures' };
const first: AssetSelectionItem = { kind: 'file', id: 2, name: 'a.png', fileType: 'image/png' };
const second: AssetSelectionItem = { kind: 'file', id: 3, name: 'b.png', fileType: 'image/png' };

describe('asset selection', () => {
  it('preserves legacy single selection shapes and creates ordered multi-selection', () => {
    expect(createAssetSelection([first])).toEqual(first);
    expect(getAssetSelectionItems(createAssetSelection([folder, first, folder]))).toEqual([folder, first]);
  });

  it('toggles selected items', () => {
    const selected = toggleAssetSelection(first, second);
    expect(getAssetSelectionItems(selected)).toEqual([first, second]);
    expect(toggleAssetSelection(selected, first)).toEqual(second);
  });

  it('selects visible ranges in tree order', () => {
    const selected = createAssetRangeSelection([folder, first, second], folder, second);
    expect(getAssetSelectionItems(selected)).toEqual([folder, first, second]);
  });
});
