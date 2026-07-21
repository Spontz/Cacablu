import { describe, expect, it } from 'vitest';
import { prepareMultiBarTimeEdit, type BarTimePlacement } from '../../src/services/multi-bar-time-edit';

function bar(id: number, layer: number, startTime: number, endTime: number): BarTimePlacement {
  return { id, layer, startTime, endTime };
}

describe('prepareMultiBarTimeEdit', () => {
  it('assigns one absolute start while preserving each individual end', () => {
    const selected = [bar(1, 0, 1, 8), bar(2, 1, 3, 10)];
    const result = prepareMultiBarTimeEdit(selected, selected, { startTime: 5 });

    expect(result).toMatchObject({ ok: true, changed: true, startChanged: true, endChanged: false });
    if (result.ok) expect(result.placements).toEqual([bar(1, 0, 5, 8), bar(2, 1, 5, 10)]);
  });

  it('assigns one absolute end while preserving each individual start', () => {
    const selected = [bar(1, 0, 1, 8), bar(2, 1, 3, 10)];
    const result = prepareMultiBarTimeEdit(selected, selected, { endTime: 12 });

    expect(result).toMatchObject({ ok: true, changed: true, startChanged: false, endChanged: true });
    if (result.ok) expect(result.placements).toEqual([bar(1, 0, 1, 12), bar(2, 1, 3, 12)]);
  });

  it('assigns both absolute endpoints to every selected bar', () => {
    const selected = [bar(1, 0, 1, 8), bar(2, 1, 3, 10)];
    const result = prepareMultiBarTimeEdit(selected, selected, { startTime: 4, endTime: 9 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.placements).toEqual([bar(1, 0, 4, 9), bar(2, 1, 4, 9)]);
  });

  it('returns an unchanged plan when neither aggregate field changed', () => {
    const selected = [bar(1, 0, 1, 8), bar(2, 1, 3, 10)];
    expect(prepareMultiBarTimeEdit(selected, selected, {})).toMatchObject({ ok: true, changed: false });
  });

  it.each([
    ['negative start', { startTime: -1 }],
    ['end equal to one start', { endTime: 3 }],
    ['end before one start', { endTime: 2 }],
    ['non-finite start', { startTime: Number.NaN }],
  ])('rejects an invalid batch: %s', (_label, requested) => {
    const selected = [bar(1, 0, 1, 8), bar(2, 1, 3, 10)];
    expect(prepareMultiBarTimeEdit(selected, selected, requested)).toEqual({ ok: false, reason: 'invalid-range' });
    expect(selected).toEqual([bar(1, 0, 1, 8), bar(2, 1, 3, 10)]);
  });

  it('rejects overlap with an unselected bar', () => {
    const selected = [bar(1, 0, 1, 4), bar(2, 1, 2, 5)];
    const all = [...selected, bar(3, 0, 6, 9)];
    expect(prepareMultiBarTimeEdit(selected, all, { startTime: 3, endTime: 7 })).toEqual({ ok: false, reason: 'overlap' });
  });

  it('rejects overlap created among selected bars on the same layer', () => {
    const selected = [bar(1, 0, 1, 3), bar(2, 0, 4, 6)];
    expect(prepareMultiBarTimeEdit(selected, selected, { startTime: 2, endTime: 6 })).toEqual({ ok: false, reason: 'overlap' });
  });

  it('allows adjacent ranges on the same layer', () => {
    const selected = [bar(1, 0, 1, 3)];
    const result = prepareMultiBarTimeEdit(selected, [...selected, bar(2, 0, 5, 8)], { startTime: 2, endTime: 5 });
    expect(result).toMatchObject({ ok: true, placements: [bar(1, 0, 2, 5)] });
  });
});
