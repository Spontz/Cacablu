import type { DbFile } from '../db/db-schema';

export type PreviewableModelFormat = 'glb' | 'gltf' | 'obj' | 'fbx' | 'dae' | '3ds' | 'lwo' | 'md2';
export type ModelPreviewMode = 'previewable' | 'fallback' | 'none';

export interface ModelPreviewDescriptor {
  isModelLike: boolean;
  format: PreviewableModelFormat | string | null;
  previewMode: ModelPreviewMode;
  reason: string | null;
}

const PREVIEWABLE_FORMATS = new Set<PreviewableModelFormat>(['glb', 'gltf', 'obj', 'fbx', 'dae', '3ds', 'lwo', 'md2']);
const FALLBACK_FORMATS = new Set(['md3', 'lws', 'blend']);
const FORMAT_ALIASES: Record<string, PreviewableModelFormat | string> = {
  collada: 'dae',
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
  'model/obj': 'obj',
  'model/vnd.collada+xml': 'dae',
  'application/octet-stream+glb': 'glb',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extensionFromName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) return '';
  return normalize(name.slice(lastDot + 1));
}

function formatFromToken(value: string): string | null {
  const token = normalize(value);
  if (!token) return null;
  if (FORMAT_ALIASES[token]) return FORMAT_ALIASES[token];
  if (PREVIEWABLE_FORMATS.has(token as PreviewableModelFormat) || FALLBACK_FORMATS.has(token)) return token;

  const modelSubtype = token.startsWith('model/') ? token.slice('model/'.length) : '';
  if (modelSubtype) {
    const subtype = modelSubtype.split(/[+;]/, 1)[0];
    if (FORMAT_ALIASES[subtype]) return FORMAT_ALIASES[subtype];
    if (PREVIEWABLE_FORMATS.has(subtype as PreviewableModelFormat) || FALLBACK_FORMATS.has(subtype)) return subtype;
  }

  return null;
}

export function describeModelPreview(file: Pick<DbFile, 'name' | 'type' | 'format' | 'data'>): ModelPreviewDescriptor {
  const format =
    formatFromToken(file.type) ??
    formatFromToken(file.format) ??
    formatFromToken(extensionFromName(file.name));

  const hasModelHint =
    format !== null ||
    normalize(file.type).startsWith('model/') ||
    normalize(file.format).startsWith('model/');

  if (!hasModelHint) {
    return { isModelLike: false, format: null, previewMode: 'none', reason: null };
  }

  if (!format) {
    return {
      isModelLike: true,
      format: null,
      previewMode: 'fallback',
      reason: 'Unsupported 3D model format.',
    };
  }

  if (file.data.byteLength === 0) {
    return {
      isModelLike: true,
      format,
      previewMode: 'fallback',
      reason: 'Model data is empty.',
    };
  }

  if (PREVIEWABLE_FORMATS.has(format as PreviewableModelFormat)) {
    return {
      isModelLike: true,
      format: format as PreviewableModelFormat,
      previewMode: 'previewable',
      reason: null,
    };
  }

  return {
    isModelLike: true,
    format,
    previewMode: 'fallback',
    reason: `Preview is not available for .${format} models yet.`,
  };
}
