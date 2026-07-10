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

  it('escapes separators inside names without dropping the original name', () => {
    expect(escapeResourcePathSegment('fx/a\\b')).toBe('fx\\/a\\\\b');
  });
});
