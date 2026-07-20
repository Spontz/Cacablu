import { describe, expect, it } from 'vitest';

import type { DbBar } from '../../src/db/db-schema';
import {
  assertPastedBarsUnchanged,
  preparePastedTimelineBars,
} from '../../src/services/timeline-bar-paste';
import { createBarClipboardEnvelope } from '../../src/services/cross-project-clipboard';

const sourceBars: DbBar[] = [
  {
    id: 4,
    name: 'A',
    type: 'shader',
    layer: 2,
    startTime: 10,
    endTime: 12,
    enabled: true,
    selected: true,
    script: 'a',
    srcBlending: 'ONE',
    dstBlending: 'ZERO',
    blendingEQ: '',
    srcAlpha: '',
    dstAlpha: '',
  },
  {
    id: 5,
    name: 'B',
    type: 'image',
    layer: 4,
    startTime: 13,
    endTime: 14,
    enabled: false,
    selected: true,
    script: 'b',
    srcBlending: 'SRC_ALPHA',
    dstBlending: 'ONE',
    blendingEQ: 'ADD',
    srcAlpha: 'ONE',
    dstAlpha: 'ZERO',
  },
];

describe('preparePastedTimelineBars', () => {
  it('anchors the group at the selected time and layer while preserving offsets and properties', () => {
    const payload = createBarClipboardEnvelope(sourceBars).payload;

    const pasted = preparePastedTimelineBars(payload, 20, 7, []);

    expect(pasted).toEqual([
      expect.objectContaining({
        name: 'A',
        layer: 7,
        startTime: 20,
        endTime: 22,
        script: 'a',
        selected: false,
      }),
      expect.objectContaining({
        name: 'B',
        layer: 9,
        startTime: 23,
        endTime: 24,
        enabled: false,
        blendingEQ: 'ADD',
        selected: false,
      }),
    ]);
    expect(pasted.every((bar) => bar.id === undefined)).toBe(true);
  });

  it('rejects destination overlap atomically instead of shifting bars', () => {
    const payload = createBarClipboardEnvelope(sourceBars).payload;
    const occupied = [{ ...sourceBars[0], id: 100, layer: 7, startTime: 21, endTime: 30 }];

    expect(() => preparePastedTimelineBars(payload, 20, 7, occupied)).toThrow(/overlap/i);
  });

  it('requires a selected non-negative layer and time', () => {
    const payload = createBarClipboardEnvelope(sourceBars).payload;

    expect(() => preparePastedTimelineBars(payload, -1, 0, [])).toThrow(/time/i);
    expect(() => preparePastedTimelineBars(payload, 0, -1, [])).toThrow(/layer/i);
  });

  it('protects Undo when a pasted bar has changed', () => {
    const pasted = [{ ...sourceBars[0], id: 40, selected: false }];
    expect(() => assertPastedBarsUnchanged(pasted, pasted)).not.toThrow();
    expect(() => assertPastedBarsUnchanged([{ ...pasted[0], name: 'edited' }], pasted)).toThrow(/changed/i);
  });
});
