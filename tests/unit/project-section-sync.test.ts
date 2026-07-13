import { describe, expect, it, vi } from 'vitest';
import { collectPhoenixSections, isSupportedPhoenixSectionType, syncProjectBarsToPhoenix } from '../../src/services/project-section-sync';
import type { ProjectDatabase } from '../../src/db/db-schema';

function makeDb(): Pick<ProjectDatabase, 'bars'> {
  return {
    bars: [
      {
        id: 17,
        name: '',
        type: 'drawImage',
        layer: 2,
        startTime: 1,
        endTime: 4,
        enabled: true,
        selected: false,
        script: 'param value',
        srcBlending: 'ONE',
        dstBlending: 'ZERO',
        blendingEQ: 'ADD',
        srcAlpha: '',
        dstAlpha: '',
      },
    ],
  };
}

describe('project section sync', () => {
  it('serializes bars as Phoenix section payloads', () => {
    const { sections: [section], issues } = collectPhoenixSections(makeDb());

    expect(issues).toEqual([]);
    expect(section).toMatchObject({
      id: '17',
      type: 'drawImage',
      startTime: 1,
      endTime: 4,
      enabled: true,
      layer: 2,
      srcBlending: 'ONE',
      dstBlending: 'ZERO',
      blendingEQ: 'ADD',
    });
    expect(new TextDecoder().decode(Uint8Array.from(atob(section.scriptBase64), (char) => char.charCodeAt(0)))).toBe('param value');
  });

  it('collects unsupported section types without fallback mappings', () => {
    expect(isSupportedPhoenixSectionType('drawImage')).toBe(true);
    expect(isSupportedPhoenixSectionType('setExpression')).toBe(true);
    expect(isSupportedPhoenixSectionType('')).toBe(false);
    expect(isSupportedPhoenixSectionType('section')).toBe(false);
    expect(isSupportedPhoenixSectionType('setVariable')).toBe(false);
    const result = collectPhoenixSections({
      bars: [
        { ...makeDb().bars[0], id: 16, type: 'drawImage' },
        { ...makeDb().bars[0], id: 17, type: 'section' },
        { ...makeDb().bars[0], id: 18, type: 'setVariable' },
      ],
    });

    expect(result.sections.map((section) => section.id)).toEqual(['16']);
    expect(result.issues).toEqual([
      {
        barId: 17,
        sectionType: 'section',
        description: 'Bar 17 was not sent to Phoenix because "section" is not a supported Phoenix section type.',
        kind: 'unsupported-type',
      },
      {
        barId: 18,
        sectionType: 'setVariable',
        description: 'Bar 18 was not sent to Phoenix because "setVariable" is not a supported Phoenix section type.',
        kind: 'unsupported-type',
      },
    ]);
  });

  it('omits disabled bars and ignores unsupported disabled types', () => {
    const result = collectPhoenixSections({
      bars: [
        { ...makeDb().bars[0], id: 16, type: 'drawImage', enabled: false },
        { ...makeDb().bars[0], id: 17, type: 'setVariable', enabled: false },
        { ...makeDb().bars[0], id: 18, type: 'drawImage', enabled: true },
      ],
    });

    expect(result.sections.map((section) => section.id)).toEqual(['18']);
    expect(result.issues).toEqual([]);
  });

  it('orders sections by layer before sending them to Phoenix', () => {
    const result = collectPhoenixSections({
      bars: [
        { ...makeDb().bars[0], id: 30, layer: 3, startTime: 1, endTime: 2 },
        { ...makeDb().bars[0], id: 10, layer: 1, startTime: 5, endTime: 6 },
        { ...makeDb().bars[0], id: 20, layer: 2, startTime: 3, endTime: 4 },
        { ...makeDb().bars[0], id: 11, layer: 1, startTime: 2, endTime: 3 },
      ],
    });

    expect(result.sections.map((section) => section.id)).toEqual(['11', '10', '20', '30']);
  });

  it('normalizes script line endings before sending sections to Phoenix', () => {
    const result = collectPhoenixSections({
      bars: [
        {
          ...makeDb().bars[0],
          script: 'sModelFilePath /pool/model.3ds\rfEnableDepthBufferClearing 0\r[shader]\rpath /pool/shader.glsl\r',
        },
      ],
    });

    const script = decodeBase64(result.sections[0].scriptBase64);
    expect(script).toBe('sModelFilePath /pool/model.3ds\r\nfEnableDepthBufferClearing 0\r\n[shader]\r\npath /pool/shader.glsl\r\n');
  });

  it('rounds section timing to three decimal places before sending it to Phoenix', () => {
    const result = collectPhoenixSections({
      bars: [{ ...makeDb().bars[0], startTime: 1.23456, endTime: 4.56789 }],
    });

    expect(result.sections[0]).toMatchObject({ startTime: 1.235, endTime: 4.568 });
  });

  it('replaces Phoenix sections when the manifest differs', async () => {
    const replaceAll = vi.fn().mockResolvedValue({
      requestId: 'sections-test',
      ok: true,
      operation: 'replace-all',
      received: 1,
      loaded: 1,
      failed: 0,
      writtenFiles: 1,
      deletedFiles: [],
      failedSections: [],
    });
    const progress: unknown[] = [];

    const result = await syncProjectBarsToPhoenix(makeDb(), {
      fetchManifest: vi.fn().mockResolvedValue({ root: 'phoenix-engine', entries: [] }),
      replaceAll,
    }, (next) => progress.push(next));

    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(replaceAll.mock.calls[0][0]).toHaveLength(1);
    expect(result).toEqual({ total: 1, valid: 1, invalid: 0, replaced: true, skipped: 0, issues: [] });
    expect(progress.at(-1)).toMatchObject({ phase: 'complete', copied: 1 });
  });

  it('skips replacement when Phoenix sections already match', async () => {
    const replaceAll = vi.fn();
    const section = collectPhoenixSections(makeDb()).sections[0];
    const content = new TextEncoder().encode([
      ':::drawImage',
      'id 17',
      'start 1',
      'end 4',
      'enabled 1',
      'layer 2',
      'blend ONE ZERO',
      'blendequation ADD',
      '',
      'param value',
    ].join('\r\n') + '\r\n');

    const result = await syncProjectBarsToPhoenix(makeDb(), {
      fetchManifest: vi.fn().mockResolvedValue({
        root: 'phoenix-engine',
        entries: [{
          id: section.id,
          type: section.type,
          startTime: section.startTime,
          endTime: section.endTime,
          enabled: section.enabled,
          layer: section.layer,
          srcBlending: section.srcBlending,
          dstBlending: section.dstBlending,
          blendingEQ: section.blendingEQ,
          contentHash: fnv1a(content),
          size: content.byteLength,
          loaded: true,
        }],
      }),
      replaceAll,
    }, () => {});

    expect(replaceAll).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, valid: 1, invalid: 0, replaced: false, skipped: 1, issues: [] });
  });

  it.each([
    ['failed', false],
    ['unknown', undefined],
  ])('replaces matching Phoenix sections when runtime state is %s', async (_state, loaded) => {
    const replaceAll = vi.fn().mockResolvedValue({
      requestId: 'sections-test',
      ok: true,
      operation: 'replace-all',
      received: 1,
      loaded: 1,
      failed: 0,
      writtenFiles: 1,
      deletedFiles: [],
      failedSections: [],
    });
    const section = collectPhoenixSections(makeDb()).sections[0];
    const content = new TextEncoder().encode([
      ':::drawImage',
      'id 17',
      'start 1',
      'end 4',
      'enabled 1',
      'layer 2',
      'blend ONE ZERO',
      'blendequation ADD',
      '',
      'param value',
    ].join('\r\n') + '\r\n');

    await syncProjectBarsToPhoenix(makeDb(), {
      fetchManifest: vi.fn().mockResolvedValue({
        root: 'phoenix-engine',
        entries: [{
          ...section,
          contentHash: fnv1a(content),
          size: content.byteLength,
          loaded,
        }],
      }),
      replaceAll,
    }, () => {});

    expect(replaceAll).toHaveBeenCalledTimes(1);
  });

  it('forces full replacement without fetching an equal manifest', async () => {
    const replaceAll = vi.fn().mockResolvedValue({
      requestId: 'sections-test',
      ok: true,
      operation: 'replace-all',
      received: 1,
      loaded: 1,
      failed: 0,
      writtenFiles: 1,
      deletedFiles: [],
      failedSections: [],
    });
    const fetchManifest = vi.fn();

    const result = await syncProjectBarsToPhoenix(makeDb(), {
      fetchManifest,
      replaceAll,
    }, () => {}, { forceReplace: true });

    expect(fetchManifest).not.toHaveBeenCalled();
    expect(replaceAll).toHaveBeenCalledWith(
      [expect.objectContaining({ id: '17', enabled: true })],
      undefined,
      expect.stringMatching(/^sections-/),
    );
    expect(result.replaced).toBe(true);
  });

  it('sends valid sections while reporting invalid bars', async () => {
    const replaceAll = vi.fn().mockResolvedValue({
      requestId: 'sections-test',
      ok: true,
      operation: 'replace-all',
      received: 1,
      loaded: 1,
      failed: 0,
      writtenFiles: 1,
      deletedFiles: [],
      failedSections: [],
    });

    const result = await syncProjectBarsToPhoenix({
      bars: [
        { ...makeDb().bars[0], id: 17, type: 'drawImage' },
        { ...makeDb().bars[0], id: 165, type: 'setVariable' },
      ],
    }, {
      fetchManifest: vi.fn().mockResolvedValue({ root: 'phoenix-engine', entries: [] }),
      replaceAll,
    }, () => {});

    expect(replaceAll).toHaveBeenCalledWith([expect.objectContaining({ id: '17', type: 'drawImage' })], undefined, expect.stringMatching(/^sections-/));
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.issues[0]).toMatchObject({ barId: 165, sectionType: 'setVariable' });
  });

  it('rounds the attached project timing residue to zero and sends both sections', async () => {
    const replaceAll = vi.fn().mockResolvedValue({
      requestId: 'sections-test',
      ok: true,
      operation: 'replace-all',
      received: 2,
      loaded: 2,
      failed: 0,
      writtenFiles: 1,
      deletedFiles: [],
      failedSections: [],
    });

    const result = await syncProjectBarsToPhoenix({
      bars: [
        { ...makeDb().bars[0], id: 22, type: 'drawVideo', startTime: -1.2578179228199107e-306, endTime: 45 },
        { ...makeDb().bars[0], id: 23, type: 'cameraFPS', layer: 0, startTime: 0, endTime: 44.44 },
      ],
    }, {
      fetchManifest: vi.fn().mockResolvedValue({ root: 'phoenix-engine', entries: [] }),
      replaceAll,
    }, () => {});

    expect(replaceAll).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: '23', type: 'cameraFPS', startTime: 0, endTime: 44.44 }),
        expect.objectContaining({ id: '22', type: 'drawVideo', startTime: 0, endTime: 45 }),
      ],
      undefined,
      expect.stringMatching(/^sections-/),
    );
    expect(result).toMatchObject({ total: 2, valid: 2, invalid: 0, replaced: true, issues: [] });
  });

  it('reports invalid Phoenix time ranges and layers per bar', () => {
    const result = collectPhoenixSections({
      bars: [
        { ...makeDb().bars[0], id: 20, startTime: 5, endTime: 4 },
        { ...makeDb().bars[0], id: 21, layer: 1.5 },
        { ...makeDb().bars[0], id: 22, endTime: Number.POSITIVE_INFINITY },
      ],
    });

    expect(result.sections).toEqual([]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ barId: 20, kind: 'invalid-payload', description: expect.stringContaining('end time') }),
      expect.objectContaining({ barId: 21, kind: 'invalid-payload', description: expect.stringContaining('32-bit integer') }),
      expect.objectContaining({ barId: 22, kind: 'invalid-payload', description: expect.stringContaining('timing') }),
    ]));
  });

  it('reports sections that Phoenix receives but cannot load', async () => {
    const result = await syncProjectBarsToPhoenix(makeDb(), {
      fetchManifest: vi.fn().mockResolvedValue({ root: 'phoenix-engine', entries: [] }),
      replaceAll: vi.fn().mockResolvedValue({
        requestId: 'sections-test',
        ok: true,
        operation: 'replace-all',
        received: 1,
        loaded: 0,
        failed: 1,
        writtenFiles: 1,
        deletedFiles: [],
        failedSections: [{ id: '17', message: 'Could not load section 17' }],
      }),
    }, () => {});

    expect(result.issues).toEqual([{
      barId: 17,
      sectionType: 'drawImage',
      description: 'Section 17 was sent to Phoenix but did not load: Could not load section 17.',
      kind: 'load-failed',
    }]);
  });

  it('completes without sending a request when every bar is invalid and Phoenix is already empty', async () => {
    const replaceAll = vi.fn();
    const result = await syncProjectBarsToPhoenix({
      bars: [{ ...makeDb().bars[0], id: 22, startTime: Number.NaN }],
    }, {
      fetchManifest: vi.fn().mockResolvedValue({ root: 'phoenix-engine', entries: [] }),
      replaceAll,
    }, () => {});

    expect(replaceAll).not.toHaveBeenCalled();
    expect(result).toMatchObject({ total: 1, valid: 0, invalid: 1, replaced: false });
    expect(result.issues).toEqual([expect.objectContaining({ barId: 22, kind: 'invalid-payload' })]);
  });
});

function fnv1a(value: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of value) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

function decodeBase64(value: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
}
