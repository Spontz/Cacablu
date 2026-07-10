import { describe, expect, it } from 'vitest';

import type { ProjectDatabase } from '../../src/db/db-schema';
import {
  exportEngineDataPool,
  type EngineDirectoryEntryHandle,
  type EngineDirectoryHandle,
} from '../../src/services/engine-data-export';

interface MemoryDirectory extends EngineDirectoryHandle {
  directories: Map<string, MemoryDirectory>;
  files: Map<string, number[] | string>;
}

function makeDb(): Pick<ProjectDatabase, 'bars' | 'fbos' | 'files' | 'folders' | 'variables'> {
  return {
    variables: new Map([
      ['fullScreen', '0'],
      ['screenWidth', '640'],
      ['screenHeight', '360'],
      ['vsync', '1'],
      ['demoName', 'Phoenix demo engine'],
      ['debug', '0'],
      ['demoLoop', '1'],
      ['sound', '0'],
      ['startTime', '0.0'],
      ['endTime', '200'],
      ['slave', '0'],
      ['debugEnableAxis', '0'],
      ['debugEnableFloor', '0'],
      ['loaderCode', [
        'id loader',
        'sFirstImage /resources/loading/customback.jpg',
        '',
        'fBarSWidth 0.04',
      ].join('\r\n')],
      ['gl_ignored', 'nope'],
    ]),
    bars: [
      {
        id: 51,
        name: '',
        type: 'drawVolumeImage',
        layer: 50,
        startTime: 0,
        endTime: 200,
        enabled: true,
        selected: false,
        script: new TextEncoder().encode('draw something here') as unknown as string,
        srcBlending: 'ONE',
        dstBlending: 'ONE_MINUS_SRC_ALPHA',
        blendingEQ: 'ADD',
        srcAlpha: 'ONE',
        dstAlpha: 'ONE_MINUS_SRC_ALPHA',
      },
    ],
    fbos: [
      { id: 1, ratio: 1, width: 0, height: 0, format: 'RGBA', colorAttachments: 2, filter: 'Bilinear' },
      { id: 21, ratio: 0, width: 512, height: 512, format: 'RGB', colorAttachments: 1, filter: 'Bilinear' },
    ],
    folders: [
      { id: 1, name: 'assets', parent: 0, enabled: true },
      { id: 2, name: 'images', parent: 1, enabled: true },
    ],
    files: [
      {
        id: 3,
        name: 'logo.png',
        parent: 2,
        bytes: 3,
        type: 'image/png',
        data: new Uint8Array([1, 2, 3]),
        format: 'png',
        enabled: true,
      },
      {
        id: 4,
        name: 'root.txt',
        parent: 0,
        bytes: 2,
        type: 'text/plain',
        data: new Uint8Array([9, 8]),
        format: 'txt',
        enabled: true,
      },
    ],
  };
}

function createMemoryDirectory(name: string): MemoryDirectory {
  const directory: MemoryDirectory = {
    name,
    kind: 'directory',
    directories: new Map(),
    files: new Map(),

    async removeEntry(childName) {
      directory.directories.delete(childName);
      directory.files.delete(childName);
    },

    async getDirectoryHandle(childName) {
      const existing = directory.directories.get(childName);
      if (existing) return existing;

      const child = createMemoryDirectory(childName);
      directory.directories.set(childName, child);
      return child;
    },

    async getFileHandle(fileName) {
      return {
        name: fileName,
        kind: 'file' as const,
        async getFile() {
          const value = directory.files.get(fileName);
          if (typeof value === 'string') return new Blob([value]);
          return new Blob([new Uint8Array(value ?? [])]);
        },
        async createWritable() {
          return {
            async write(data) {
              if (typeof data === 'string') {
                directory.files.set(fileName, data);
                return;
              }

              if (data instanceof Blob) {
                directory.files.set(fileName, [...new Uint8Array(await data.arrayBuffer())]);
                return;
              }

              if (data instanceof ArrayBuffer) {
                directory.files.set(fileName, [...new Uint8Array(data)]);
                return;
              }

              throw new Error('Expected ArrayBuffer or string file data');
            },
            async close() {
              return;
            },
          };
        },
      };
    },

    async *values() {
      const entries: EngineDirectoryEntryHandle[] = [
        ...directory.directories.values(),
        ...[...directory.files.keys()].map((fileName) => ({
          name: fileName,
          kind: 'file' as const,
          async getFile() {
            const value = directory.files.get(fileName);
            if (typeof value === 'string') return new Blob([value]);
            return new Blob([new Uint8Array(value ?? [])]);
          },
          async createWritable() {
            return {
              async write(data: BufferSource | Blob | string) {
                if (typeof data === 'string') {
                  directory.files.set(fileName, data);
                  return;
                }

                if (data instanceof Blob) {
                  directory.files.set(fileName, [...new Uint8Array(await data.arrayBuffer())]);
                  return;
                }

                if (data instanceof ArrayBuffer) {
                  directory.files.set(fileName, [...new Uint8Array(data)]);
                  return;
                }

                throw new Error('Expected ArrayBuffer, Blob, or string file data');
              },
              async close() {
                return;
              },
            };
          },
        })),
      ];

      for (const entry of entries) yield entry;
    },
  };

  return directory;
}

describe('exportEngineDataPool', () => {
  it('recreates data, writes data/pool resources, .spo sections, and data/config graphics config', async () => {
    const engineDirectory = createMemoryDirectory('engine');
    const staleData = createMemoryDirectory('data');
    const resourcesDirectory = createMemoryDirectory('resources');
    const shadersDirectory = createMemoryDirectory('shaders');
    staleData.files.set('old.spo', 'stale');
    resourcesDirectory.files.set('shared.txt', [7, 7]);
    shadersDirectory.files.set('default.frag', 'shader text');
    resourcesDirectory.directories.set('shaders', shadersDirectory);
    engineDirectory.directories.set('data', staleData);
    engineDirectory.directories.set('resources', resourcesDirectory);

    const result = await exportEngineDataPool({
      db: makeDb(),
      pickDirectory: async () => engineDirectory,
    });

    const dataDirectory = engineDirectory.directories.get('data');
    const poolDirectory = dataDirectory?.directories.get('pool');
    const configDirectory = dataDirectory?.directories.get('config');
    const copiedResourcesDirectory = dataDirectory?.directories.get('resources');
    const assetsDirectory = poolDirectory?.directories.get('assets');
    const imagesDirectory = assetsDirectory?.directories.get('images');

    expect(result).toEqual({
      status: 'success',
      directoryName: 'engine',
      filesWritten: 2,
      sectionsWritten: 1,
      resourcesCopied: 2,
      configWritten: true,
    });
    expect(dataDirectory?.files.has('old.spo')).toBe(false);
    expect(configDirectory?.files.get('graphics.spo')).toBe([
      'gl_fullscreen 0',
      'gl_width 640',
      'gl_height 360',
      'gl_aspect 1.7777777777777777',
      'gl_vsync 1',
      'gl_colorDepth ',
      '',
      'fbo_0_ratio 1',
      'fbo_0_format RGBA',
      'fbo_0_colorAttachments 2',
      'fbo_0_useFilter 1',
      '',
      'fbo_20_width 512',
      'fbo_20_height 512',
      'fbo_20_format RGB',
      'fbo_20_colorAttachments 1',
      'fbo_20_useFilter 1',
      '',
    ].join('\r\n'));
    expect(configDirectory?.files.get('loader.spo')).toBe([
      ':::loading',
      'id loader',
      'sFirstImage /resources/loading/customback.jpg',
      '',
      'fBarSWidth 0.04',
      '',
    ].join('\r\n'));
    expect(configDirectory?.files.get('control.spo')).toBe([
      'demo_name Phoenix demo engine',
      'debug 1',
      'loop 1',
      'sound 1',
      'demo_start 0.0',
      'demo_end 200',
      'slave 1',
      'debugEnableAxis 1',
      'debugEnableFloor 1',
      '',
    ].join('\r\n'));
    expect(poolDirectory?.files.get('root.txt')).toEqual([9, 8]);
    expect(imagesDirectory?.files.get('logo.png')).toEqual([1, 2, 3]);
    expect(copiedResourcesDirectory?.files.get('shared.txt')).toEqual([7, 7]);
    expect(copiedResourcesDirectory?.directories.get('shaders')?.files.get('default.frag')).toEqual([115, 104, 97, 100, 101, 114, 32, 116, 101, 120, 116]);
    expect(dataDirectory?.files.get('51-drawVolumeImage.spo')).toBe([
      ':::drawVolumeImage',
      'id 51',
      'start 0',
      'end 200',
      'enabled 1',
      'layer 50',
      'blend ONE ONE_MINUS_SRC_ALPHA',
      'blendequation ADD',
      '',
      'draw something here',
    ].join('\r\n'));
  });

  it('does not create data folders when folder selection is cancelled', async () => {
    const result = await exportEngineDataPool({
      db: makeDb(),
      pickDirectory: async () => null,
    });

    expect(result).toEqual({ status: 'cancelled' });
  });
});
