import { describe, expect, it } from 'vitest';

import {
  CAM_COLUMN_COLOR_COUNT,
  camColumnClassName,
  findCamColumnTokens,
} from '../../src/panels/cam-column-highlighting';

describe('CAM column highlighting', () => {
  it('assigns stable zero-based columns across space-separated rows', () => {
    expect(findCamColumnTokens('1  2 3\n4 5   6')).toEqual([
      { lineNumber: 1, startColumn: 1, endColumn: 2, columnIndex: 0 },
      { lineNumber: 1, startColumn: 4, endColumn: 5, columnIndex: 1 },
      { lineNumber: 1, startColumn: 6, endColumn: 7, columnIndex: 2 },
      { lineNumber: 2, startColumn: 1, endColumn: 2, columnIndex: 0 },
      { lineNumber: 2, startColumn: 3, endColumn: 4, columnIndex: 1 },
      { lineNumber: 2, startColumn: 7, endColumn: 8, columnIndex: 2 },
    ]);
  });

  it('treats mixed runs of spaces and tabs as one separator', () => {
    expect(findCamColumnTokens('\t  -1\t \t2.5  label\t')).toEqual([
      { lineNumber: 1, startColumn: 4, endColumn: 6, columnIndex: 0 },
      { lineNumber: 1, startColumn: 9, endColumn: 12, columnIndex: 1 },
      { lineNumber: 1, startColumn: 14, endColumn: 19, columnIndex: 2 },
    ]);
  });

  it('supports blank lines, CRLF, and irregular row widths', () => {
    expect(findCamColumnTokens('a\tb\r\n\r\nc\td\te\r\n')).toEqual([
      { lineNumber: 1, startColumn: 1, endColumn: 2, columnIndex: 0 },
      { lineNumber: 1, startColumn: 3, endColumn: 4, columnIndex: 1 },
      { lineNumber: 3, startColumn: 1, endColumn: 2, columnIndex: 0 },
      { lineNumber: 3, startColumn: 3, endColumn: 4, columnIndex: 1 },
      { lineNumber: 3, startColumn: 5, endColumn: 6, columnIndex: 2 },
    ]);
  });

  it('recomputes positions from edited text without changing the text', () => {
    const content = '10\t20 30';
    const edited = '10\t20\t25 30';

    expect(findCamColumnTokens(content).map((token) => token.columnIndex)).toEqual([0, 1, 2]);
    expect(findCamColumnTokens(edited).map((token) => token.columnIndex)).toEqual([0, 1, 2, 3]);
    expect(edited).toBe('10\t20\t25 30');
  });

  it('maps every column deterministically while keeping adjacent palette entries distinct', () => {
    for (let column = 0; column < CAM_COLUMN_COLOR_COUNT * 3; column += 1) {
      expect(camColumnClassName(column)).toBe(camColumnClassName(column + CAM_COLUMN_COLOR_COUNT));
      expect(camColumnClassName(column)).not.toBe(camColumnClassName(column + 1));
    }
  });
});
