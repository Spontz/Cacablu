import { describe, expect, it } from 'vitest';

import type { ProjectDatabase } from '../../src/db/db-schema';
import { buildResourceTree, escapeResourcePathSegment } from '../../src/resources/resource-tree';

function makeDb(partial: Pick<ProjectDatabase, 'folders' | 'files'>): ProjectDatabase {
  return {
    variables: new Map(),
    bars: [],
    fbos: [],
    markers: [],
    folders: partial.folders,
    files: partial.files,
  };
}

describe('buildResourceTree', () => {
  it('builds the same folder-first hierarchy shown by resources panel data', () => {
    const tree = buildResourceTree(makeDb({
      folders: [
        { id: 1, name: 'assets', parent: 0, enabled: true },
        { id: 2, name: 'images', parent: 1, enabled: true },
      ],
      files: [
        {
          id: 10,
          name: 'logo.png',
          parent: 2,
          bytes: 42,
          type: 'image/png',
          data: new Uint8Array([1]),
          format: 'png',
          enabled: true,
        },
      ],
    }));

    expect(tree).toEqual([
      {
        kind: 'folder',
        id: 1,
        name: 'assets',
        path: 'assets',
        enabled: true,
        children: [
          {
            kind: 'folder',
            id: 2,
            name: 'images',
            path: 'assets/images',
            enabled: true,
            children: [
              {
                kind: 'file',
                id: 10,
                name: 'logo.png',
                path: 'assets/images/logo.png',
                parentId: 2,
                type: 'image/png',
                format: 'png',
                bytes: 42,
                enabled: true,
              },
            ],
          },
        ],
      },
    ]);
  });

  it('keeps duplicate file names distinguishable by id and path', () => {
    const tree = buildResourceTree(makeDb({
      folders: [
        { id: 1, name: 'a', parent: 0, enabled: true },
        { id: 2, name: 'b', parent: 0, enabled: true },
      ],
      files: [
        { id: 10, name: 'same.txt', parent: 1, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'txt', enabled: true },
        { id: 11, name: 'same.txt', parent: 2, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'txt', enabled: true },
      ],
    }));

    expect(JSON.stringify(tree)).toContain('"path":"a/same.txt"');
    expect(JSON.stringify(tree)).toContain('"path":"b/same.txt"');
    expect(JSON.stringify(tree)).toContain('"id":10');
    expect(JSON.stringify(tree)).toContain('"id":11');
  });

  it('sorts folders and files alphabetically at every level', () => {
    const tree = buildResourceTree(makeDb({
      folders: [
        { id: 3, name: 'zeta', parent: 0, enabled: true },
        { id: 2, name: 'Alpha', parent: 0, enabled: true },
        { id: 5, name: 'nested-z', parent: 2, enabled: true },
        { id: 4, name: 'nested-a', parent: 2, enabled: true },
      ],
      files: [
        { id: 14, name: 'shader10.glsl', parent: 0, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'glsl', enabled: true },
        { id: 13, name: 'Shader2.glsl', parent: 0, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'glsl', enabled: true },
        { id: 12, name: 'z-last.txt', parent: 2, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'txt', enabled: true },
        { id: 11, name: 'A-first.txt', parent: 2, bytes: 1, type: 'text/plain', data: new Uint8Array(), format: 'txt', enabled: true },
      ],
    }));

    expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual([
      'folder:Alpha',
      'folder:zeta',
      'file:Shader2.glsl',
      'file:shader10.glsl',
    ]);
    expect(tree[0].kind).toBe('folder');
    if (tree[0].kind !== 'folder') throw new Error('Expected Alpha to be a folder.');
    expect(tree[0].children.map((node) => `${node.kind}:${node.name}`)).toEqual([
      'folder:nested-a',
      'folder:nested-z',
      'file:A-first.txt',
      'file:z-last.txt',
    ]);
  });

  it('escapes separators inside names without dropping the original name', () => {
    expect(escapeResourcePathSegment('fx/a\\b')).toBe('fx\\/a\\\\b');
  });
});
