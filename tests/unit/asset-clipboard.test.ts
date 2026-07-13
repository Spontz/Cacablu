import { describe, expect, it, vi } from 'vitest';

import type { ProjectDatabase } from '../../src/db/db-schema';
import {
  canonicalizeSelection,
  createAssetClipboard,
  normalizePoolPath,
  pendingCutKeys,
  resolveAssetPasteParent,
  serializePoolPaths,
} from '../../src/resources/asset-clipboard';

function createProject(): ProjectDatabase {
  return {
    variables: new Map(),
    bars: [],
    fbos: [],
    markers: [],
    folders: [
      { id: 1, name: 'textures', parent: 0, enabled: true },
      { id: 2, name: 'nested', parent: 1, enabled: true },
    ],
    files: [
      { id: 3, name: 'hero.png', parent: 1, bytes: 2, type: 'image/png', data: new Uint8Array([1, 2]), format: 'png', enabled: true },
      { id: 4, name: 'note.txt', parent: 2, bytes: 1, type: 'text/plain', data: new Uint8Array([3]), format: 'txt', enabled: false },
    ],
  };
}

describe('asset clipboard', () => {
  it('normalizes Pool paths and serializes unique paths one per line', () => {
    expect(normalizePoolPath('pool\\textures\\hero.png')).toBe('/pool/textures/hero.png');
    expect(serializePoolPaths(['/pool/a.txt', 'pool/a.txt', 'pool/b.txt'])).toBe('/pool/a.txt\n/pool/b.txt');
    expect(() => normalizePoolPath('/pool/../secret')).toThrow('traversal');
  });

  it('removes descendants of selected folders from canonical roots', () => {
    const db = createProject();
    expect(canonicalizeSelection(db, [
      { kind: 'folder', id: 1, name: 'textures' },
      { kind: 'file', id: 3, name: 'hero.png', fileType: 'image/png' },
      { kind: 'folder', id: 2, name: 'nested' },
    ])).toEqual([{ kind: 'folder', id: 1, name: 'textures' }]);
  });

  it('resolves single paste destinations and rejects ambiguous selections', () => {
    const db = createProject();
    expect(resolveAssetPasteParent(db, { kind: 'none' })).toBe(0);
    expect(resolveAssetPasteParent(db, { kind: 'folder', id: 2, name: 'nested' })).toBe(2);
    expect(resolveAssetPasteParent(db, { kind: 'file', id: 3, name: 'hero.png', fileType: 'image/png' })).toBe(1);
    expect(() => resolveAssetPasteParent(db, {
      kind: 'multiple',
      items: [
        { kind: 'folder', id: 1, name: 'textures' },
        { kind: 'folder', id: 2, name: 'nested' },
      ],
    })).toThrow('single Pool destination');
  });

  it('captures immutable copy data and keeps copies available', () => {
    const db = createProject();
    const clipboard = createAssetClipboard();
    const session = {};
    const snapshot = clipboard.capture('copy', session, db, [
      { kind: 'file', id: 3, name: 'hero.png', fileType: 'image/png' },
    ]);

    db.files[0].data[0] = 9;
    expect(snapshot.text).toBe('/pool/textures/hero.png');
    expect(snapshot.roots[0].kind === 'file' ? [...snapshot.roots[0].data] : []).toEqual([1, 2]);
    clipboard.consumeCut();
    expect(clipboard.getSnapshot()).toBe(snapshot);
  });

  it('publishes pending cut changes and invalidates replaced or stale cuts', () => {
    const db = createProject();
    const clipboard = createAssetClipboard();
    const session = {};
    const listener = vi.fn();
    clipboard.subscribe(listener);

    const snapshot = clipboard.capture('cut', session, db, [
      { kind: 'folder', id: 1, name: 'textures' },
    ]);
    expect(pendingCutKeys(snapshot)).toEqual(new Set(['folder:1']));
    expect(clipboard.revalidateText(snapshot.text)).toBe(true);
    expect(clipboard.revalidateText('/pool/other.txt')).toBe(false);
    expect(clipboard.getSnapshot()).toBeNull();

    clipboard.capture('cut', session, db, [{ kind: 'folder', id: 1, name: 'textures' }]);
    clipboard.invalidateSession({});
    expect(clipboard.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalled();
  });
});
