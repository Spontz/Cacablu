import { describe, expect, it } from 'vitest';

import { describeModelPreview } from '../../src/panels/model-preview';

const bytes = new Uint8Array([1, 2, 3]);

describe('describeModelPreview', () => {
  it.each([
    ['model.glb', '', '', 'glb'],
    ['model.gltf', '', '', 'gltf'],
    ['model.obj', '', '', 'obj'],
    ['model.fbx', '', '', 'fbx'],
    ['model.dae', '', '', 'dae'],
    ['legacy.3ds', '', '', '3ds'],
    ['lightwave.lwo', '', '', 'lwo'],
    ['quake.md2', '', '', 'md2'],
    ['asset.bin', 'model/gltf-binary', '', 'glb'],
    ['asset.bin', '', 'collada', 'dae'],
  ])('marks %s as previewable %s', (name, type, format, expectedFormat) => {
    expect(describeModelPreview({ name, type, format, data: bytes })).toEqual({
      isModelLike: true,
      format: expectedFormat,
      previewMode: 'previewable',
      reason: null,
    });
  });

  it.each([
    ['quake.md3', 'md3'],
    ['scene.lws', 'lws'],
    ['source.blend', 'blend'],
  ])('recognizes %s as fallback %s', (name, expectedFormat) => {
    expect(describeModelPreview({ name, type: '', format: '', data: bytes })).toEqual({
      isModelLike: true,
      format: expectedFormat,
      previewMode: 'fallback',
      reason: `Preview is not available for .${expectedFormat} models yet.`,
    });
  });

  it('treats unknown non-model files as non-models', () => {
    expect(describeModelPreview({
      name: 'readme.txt',
      type: 'text/plain',
      format: '',
      data: bytes,
    })).toEqual({
      isModelLike: false,
      format: null,
      previewMode: 'none',
      reason: null,
    });
  });

  it('returns fallback for empty previewable model data', () => {
    expect(describeModelPreview({
      name: 'empty.glb',
      type: '',
      format: '',
      data: new Uint8Array(),
    })).toEqual({
      isModelLike: true,
      format: 'glb',
      previewMode: 'fallback',
      reason: 'Model data is empty.',
    });
  });

  it('returns fallback for unsupported model metadata', () => {
    expect(describeModelPreview({
      name: 'asset.bin',
      type: 'model/step',
      format: '',
      data: bytes,
    })).toEqual({
      isModelLike: true,
      format: null,
      previewMode: 'fallback',
      reason: 'Unsupported 3D model format.',
    });
  });
});
