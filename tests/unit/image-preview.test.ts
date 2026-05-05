import { describe, expect, it } from 'vitest';

import { describeImagePreview } from '../../src/panels/image-preview';

const bytes = new Uint8Array([1, 2, 3]);

describe('describeImagePreview', () => {
  it.each([
    ['photo.png', '', '', 'image/png'],
    ['photo.jpg', '', '', 'image/jpeg'],
    ['photo.jpeg', '', '', 'image/jpeg'],
    ['photo.gif', '', '', 'image/gif'],
    ['photo.webp', '', '', 'image/webp'],
    ['photo.bmp', '', '', 'image/bmp'],
    ['photo.svg', '', '', 'image/svg+xml'],
    ['asset.bin', 'image/png', '', 'image/png'],
    ['asset.bin', '', 'jpeg', 'image/jpeg'],
  ])('recognizes %s as %s', (name, type, format, mimeType) => {
    expect(describeImagePreview({ name, type, format, data: bytes })).toEqual({
      isImageLike: true,
      mimeType,
      reason: null,
    });
  });

  it('treats unknown files as non-images', () => {
    expect(describeImagePreview({
      name: 'readme.txt',
      type: 'text/plain',
      format: '',
      data: bytes,
    })).toEqual({
      isImageLike: false,
      mimeType: null,
      reason: null,
    });
  });

  it('returns a fallback descriptor for empty image data', () => {
    expect(describeImagePreview({
      name: 'empty.png',
      type: '',
      format: '',
      data: new Uint8Array(),
    })).toEqual({
      isImageLike: true,
      mimeType: 'image/png',
      reason: 'Image data is empty.',
    });
  });

  it('returns a fallback descriptor for unsupported image metadata', () => {
    expect(describeImagePreview({
      name: 'texture.exr',
      type: 'image/exr',
      format: '',
      data: bytes,
    })).toEqual({
      isImageLike: true,
      mimeType: null,
      reason: 'Unsupported image format.',
    });
  });
});
