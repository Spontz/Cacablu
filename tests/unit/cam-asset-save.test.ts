import { describe, expect, it } from 'vitest';

import { getCamPhoenixSaveAction, isCamAssetName } from '../../src/services/cam-asset-save';

describe('CAM asset save policy', () => {
  it('recognizes CAM extensions case-insensitively', () => {
    expect(isCamAssetName('camera.cam')).toBe(true);
    expect(isCamAssetName('CAMERA.CAM')).toBe(true);
    expect(isCamAssetName('camera.cam.backup')).toBe(false);
  });

  it('keeps disabled saves local regardless of connection state', () => {
    expect(getCamPhoenixSaveAction(false, false)).toBe('local-only');
    expect(getCamPhoenixSaveAction(false, true)).toBe('local-only');
  });

  it('syncs enabled connected saves and warns for enabled offline saves', () => {
    expect(getCamPhoenixSaveAction(true, true)).toBe('sync');
    expect(getCamPhoenixSaveAction(true, false)).toBe('warn-offline');
  });
});
