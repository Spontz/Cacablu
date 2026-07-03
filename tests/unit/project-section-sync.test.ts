import { describe, expect, it, vi } from 'vitest';
import { collectPhoenixSections, isSupportedPhoenixSectionType, ProjectSectionSyncError, syncProjectBarsToPhoenix } from '../../src/services/project-section-sync';
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
      },
      {
        barId: 18,
        sectionType: 'setVariable',
        description: 'Bar 18 was not sent to Phoenix because "setVariable" is not a supported Phoenix section type.',
      },
    ]);
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
        }],
      }),
      replaceAll,
    }, () => {});

    expect(replaceAll).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, valid: 1, invalid: 0, replaced: false, skipped: 1, issues: [] });
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

    expect(replaceAll).toHaveBeenCalledWith([expect.objectContaining({ id: '17', type: 'drawImage' })], undefined);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.issues[0]).toMatchObject({ barId: 165, sectionType: 'setVariable' });
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
    }]);
  });

  it('fails when every bar is invalid', async () => {
    await expect(syncProjectBarsToPhoenix({
      bars: [{ ...makeDb().bars[0], id: 165, type: 'setVariable' }],
    }, {
      fetchManifest: vi.fn(),
      replaceAll: vi.fn(),
    }, () => {})).rejects.toBeInstanceOf(ProjectSectionSyncError);
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
