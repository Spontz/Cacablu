import type { DbFile } from '../db/db-schema';

export interface ImagePreviewDescriptor {
  isImageLike: boolean;
  mimeType: string | null;
  reason: string | null;
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extensionFromName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) return '';
  return normalize(name.slice(lastDot + 1));
}

function mimeFromToken(value: string): string | null {
  const token = normalize(value);
  if (!token) return null;

  if (token in IMAGE_TYPES) return IMAGE_TYPES[token];
  if (token === 'image/jpg') return 'image/jpeg';

  const direct = Object.values(IMAGE_TYPES).find((mimeType) => mimeType === token);
  if (direct) return direct;

  if (token.startsWith('image/')) {
    const subtype = token.slice('image/'.length).split(/[+;]/, 1)[0];
    return IMAGE_TYPES[subtype] ?? null;
  }

  return null;
}

export function describeImagePreview(file: Pick<DbFile, 'name' | 'type' | 'format' | 'data'>): ImagePreviewDescriptor {
  const mimeType =
    mimeFromToken(file.type) ??
    mimeFromToken(file.format) ??
    mimeFromToken(extensionFromName(file.name));

  const hasImageHint =
    mimeType !== null ||
    normalize(file.type).startsWith('image/') ||
    normalize(file.format).startsWith('image/');

  if (!hasImageHint) {
    return { isImageLike: false, mimeType: null, reason: null };
  }

  if (!mimeType) {
    return { isImageLike: true, mimeType: null, reason: 'Unsupported image format.' };
  }

  if (file.data.byteLength === 0) {
    return { isImageLike: true, mimeType, reason: 'Image data is empty.' };
  }

  return { isImageLike: true, mimeType, reason: null };
}
