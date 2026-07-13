import { describe, expect, it, vi } from 'vitest';

import type { ResourceClipboardMutation } from '../../src/db/db-session';
import { syncResourceClipboardMutation } from '../../src/services/resource-clipboard-sync';
import { createAppState } from '../../src/state/app-state';

function mutation(operation: 'copy' | 'move' = 'move'): ResourceClipboardMutation {
  return {
    operation,
    roots: [{ kind: 'file', id: 1 }],
    files: [
      {
        file: { id: 1, name: 'hero.png', parent: 2, bytes: 2, type: 'image/png', data: new Uint8Array([1, 2]), format: 'png', enabled: true },
        oldPath: '/pool/source/hero.png',
        newPath: '/pool/target/hero.png',
      },
      {
        file: { id: 2, name: 'disabled.txt', parent: 2, bytes: 1, type: 'text/plain', data: new Uint8Array([3]), format: 'txt', enabled: false },
        oldPath: '/pool/source/disabled.txt',
        newPath: '/pool/target/disabled.txt',
      },
    ],
  };
}

function ok(operation: 'write-file' | 'delete-file') {
  return { requestId: 'request', ok: true, operation } as const;
}

describe('resource clipboard Phoenix synchronization', () => {
  it('writes enabled destinations before deleting enabled move sources', async () => {
    const calls: string[] = [];
    const client = {
      writeFile: vi.fn(async (path: string) => { calls.push(`write:${path}`); return ok('write-file'); }),
      deleteFile: vi.fn(async (path: string) => { calls.push(`delete:${path}`); return ok('delete-file'); }),
    };

    await syncResourceClipboardMutation(mutation(), client, createAppState(), true);

    expect(calls).toEqual(['write:pool/target/hero.png', 'delete:pool/source/hero.png']);
  });

  it('does not delete sources for copies and skips all Phoenix work while disconnected', async () => {
    const client = { writeFile: vi.fn(async () => ok('write-file')), deleteFile: vi.fn(async () => ok('delete-file')) };
    await syncResourceClipboardMutation(mutation('copy'), client, createAppState(), true);
    expect(client.writeFile).toHaveBeenCalledTimes(1);
    expect(client.deleteFile).not.toHaveBeenCalled();

    client.writeFile.mockClear();
    await syncResourceClipboardMutation(mutation(), client, createAppState(), false);
    expect(client.writeFile).not.toHaveBeenCalled();
  });

  it('keeps old Phoenix paths after write failures and records discrepancies in Events', async () => {
    const state = createAppState();
    const client = {
      writeFile: vi.fn(async () => { throw new Error('write failed'); }),
      deleteFile: vi.fn(async () => ok('delete-file')),
    };

    await syncResourceClipboardMutation(mutation(), client, state, true);

    expect(client.deleteFile).not.toHaveBeenCalled();
    expect(state.getSnapshot().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'warning', source: 'Pool clipboard', description: expect.stringContaining('write failed') }),
    ]));
  });
});
