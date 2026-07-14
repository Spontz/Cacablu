import { describe, expect, it, vi } from 'vitest';

import type { AssetOperationResult } from '../../src/phoenix/asset-client';
import { addAssetImpactEvents, runAssetOperationWithEvents } from '../../src/phoenix/asset-impact-events';
import type { PhoenixLogClient, PhoenixLogEntry } from '../../src/phoenix/log-client';
import { createAppState } from '../../src/state/app-state';

function result(overrides: Partial<AssetOperationResult> = {}): AssetOperationResult {
  return {
    requestId: 'asset-test',
    ok: true,
    operation: 'preview-asset',
    reloadedSections: [],
    deactivatedSections: [],
    failedSections: [],
    ...overrides,
  };
}

function logs(...responses: PhoenixLogEntry[][]): PhoenixLogClient {
  return {
    fetchRecent: vi.fn(async () => responses.shift() ?? []),
  };
}

describe('Phoenix asset impact Events', () => {
  it('records and marks every failed or deactivated dependent section', () => {
    const state = createAppState();

    addAssetImpactEvents(state, result({
      failedSections: [
        { id: '17', type: 'efxBloom', message: 'Fragment shader compilation failed.' },
        { id: '23', type: 'efxBlur', message: 'Could not reload section.' },
      ],
      deactivatedSections: [
        { id: '31', type: 'efxImage', message: 'Required shader is unavailable.' },
      ],
    }), 'Previewed pool/shaders/example.glsl');

    expect(state.getSnapshot().sectionErrorIds).toEqual([17, 23, 31]);
    expect(state.getSnapshot().events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        source: 'Phoenix asset impact',
        subjectId: '17',
        description: expect.stringContaining('Fragment shader compilation failed.'),
      }),
      expect.objectContaining({ severity: 'error', subjectId: '23' }),
      expect.objectContaining({ severity: 'warning', subjectId: '31' }),
    ]));
  });

  it('suppresses earlier logs and records detailed compiler errors from the operation', async () => {
    const state = createAppState();
    const oldLog: PhoenixLogEntry = { sequence: 81001, severity: 'error', message: 'Earlier unrelated error' };
    const compileLog: PhoenixLogEntry = {
      sequence: 81002,
      severity: 'error',
      message: 'Shader Compile (Fragment - pool/shaders/example.glsl) log: syntax error',
    };
    const sectionLog: PhoenixLogEntry = {
      sequence: 81003,
      severity: 'error',
      message: 'Section efxBloom [id: 17, DataSource: Network] not loaded properly!',
    };

    await runAssetOperationWithEvents(
      state,
      logs([oldLog], [oldLog, compileLog, sectionLog]),
      'Previewed pool/shaders/example.glsl',
      async () => result({ failedSections: [{ id: '17', message: 'Could not reload section.' }] }),
    );

    const events = state.getSnapshot().events;
    expect(events.some((event) => event.description.includes('Earlier unrelated error'))).toBe(false);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', subjectId: '17', description: expect.stringContaining('syntax error') }),
      expect.objectContaining({ severity: 'error', subjectId: '17', description: expect.stringContaining('not loaded properly') }),
    ]));
    expect(state.getSnapshot().sectionErrorIds).toEqual([17]);
  });

  it('records Phoenix errors even when the asset operation rejects', async () => {
    const state = createAppState();
    const compileLog: PhoenixLogEntry = {
      sequence: 82001,
      severity: 'error',
      message: 'Shader Linking: file pool/shaders/example.glsl, log: link failed',
    };

    await expect(runAssetOperationWithEvents(
      state,
      logs([], [compileLog]),
      'Saved example.glsl',
      async () => { throw new Error('Phoenix rejected the write'); },
    )).rejects.toThrow('Phoenix rejected the write');

    expect(state.getSnapshot().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', description: expect.stringContaining('link failed') }),
    ]));
  });

  it('clears recovered sections without clearing sections that still fail', () => {
    const state = createAppState();
    addAssetImpactEvents(state, result({
      failedSections: [
        { id: '17', message: 'First section failed.' },
        { id: '23', message: 'Second section failed.' },
      ],
    }), 'Broken shader');
    state.addEvents([
      { severity: 'error', source: 'Phoenix log', subjectId: '17', description: 'Compiler error for 17.' },
      { severity: 'error', source: 'Other subsystem', subjectId: '17', description: 'Unrelated error for 17.' },
    ]);

    addAssetImpactEvents(state, result({
      reloadedSections: [{ id: '17', message: 'Reloaded.' }],
      failedSections: [{ id: '23', message: 'Still failing.' }],
    }), 'Repaired shader');

    expect(state.getSnapshot().sectionErrorIds).toEqual([23]);
    expect(state.getSnapshot().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'Other subsystem', subjectId: '17' }),
      expect.objectContaining({ source: 'Phoenix asset impact', subjectId: '23', description: expect.stringContaining('Still failing.') }),
    ]));
    expect(state.getSnapshot().events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'Phoenix log', subjectId: '17' }),
      expect.objectContaining({ source: 'Phoenix asset impact', subjectId: '17' }),
    ]));
  });
});
