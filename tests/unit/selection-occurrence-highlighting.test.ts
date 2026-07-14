import { describe, expect, it, vi } from 'vitest';

import { findSelectionOccurrenceRanges } from '../../src/panels/selection-occurrence-highlighting';

const primary = {
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 1,
  endColumn: 4,
};

const secondary = {
  startLineNumber: 2,
  startColumn: 5,
  endLineNumber: 2,
  endColumn: 8,
};

function selection(range = primary) {
  return {
    ...range,
    selectionStartLineNumber: range.startLineNumber,
    selectionStartColumn: range.startColumn,
    positionLineNumber: range.endLineNumber,
    positionColumn: range.endColumn,
  };
}

function model(selectedText: string, ranges = [primary, secondary]) {
  return {
    getValueInRange: vi.fn(() => selectedText),
    findMatches: vi.fn(() => ranges.map((range) => ({ range, matches: null }))),
  };
}

function asSelectionModel(fixture: ReturnType<typeof model>) {
  return fixture as unknown as Parameters<typeof findSelectionOccurrenceRanges>[0];
}

describe('selection occurrence highlighting', () => {
  it('finds literal case-sensitive matches and excludes the primary selection', () => {
    const fixture = model('foo');

    const result = findSelectionOccurrenceRanges(asSelectionModel(fixture), selection());

    expect(result).toEqual([secondary]);
    expect(fixture.findMatches).toHaveBeenCalledWith('foo', false, false, true, null, false, 1_000);
  });

  it('passes punctuation and spaces as one complete literal query', () => {
    const fixture = model('/pool/my shader.glsl');

    findSelectionOccurrenceRanges(asSelectionModel(fixture), selection());

    expect(fixture.findMatches).toHaveBeenCalledWith('/pool/my shader.glsl', false, false, true, null, false, 1_000);
  });

  it('does not search empty or whitespace-only selections', () => {
    const emptyFixture = model('anything');
    const whitespaceFixture = model('  \n');
    const emptySelection = selection({ ...primary, endColumn: primary.startColumn });

    expect(findSelectionOccurrenceRanges(asSelectionModel(emptyFixture), emptySelection)).toEqual([]);
    expect(findSelectionOccurrenceRanges(asSelectionModel(whitespaceFixture), selection())).toEqual([]);
    expect(emptyFixture.findMatches).not.toHaveBeenCalled();
    expect(whitespaceFixture.findMatches).not.toHaveBeenCalled();
  });

  it('returns every secondary range while preserving case-sensitive filtering from Monaco', () => {
    const third = { startLineNumber: 4, startColumn: 2, endLineNumber: 4, endColumn: 5 };
    const fixture = model('Foo', [primary, secondary, third]);

    expect(findSelectionOccurrenceRanges(asSelectionModel(fixture), selection())).toEqual([secondary, third]);
  });
});
