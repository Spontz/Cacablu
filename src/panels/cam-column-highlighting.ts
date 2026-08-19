export interface CamColumnToken {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  columnIndex: number;
}

export const CAM_COLUMN_COLOR_COUNT = 10;

export function findCamColumnTokens(content: string): CamColumnToken[] {
  const tokens: CamColumnToken[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    let offset = 0;
    let columnIndex = 0;

    while (offset < line.length) {
      while (offset < line.length && isHorizontalSeparator(line[offset])) offset += 1;
      if (offset >= line.length) break;

      const start = offset;
      while (offset < line.length && !isHorizontalSeparator(line[offset])) offset += 1;
      tokens.push({
        lineNumber: lineIndex + 1,
        startColumn: start + 1,
        endColumn: offset + 1,
        columnIndex,
      });
      columnIndex += 1;
    }
  }

  return tokens;
}

export function camColumnClassName(columnIndex: number): string {
  const paletteIndex = ((columnIndex % CAM_COLUMN_COLOR_COUNT) + CAM_COLUMN_COLOR_COUNT) % CAM_COLUMN_COLOR_COUNT;
  return `cam-editor-column-${paletteIndex}`;
}

function isHorizontalSeparator(character: string): boolean {
  return character === ' ' || character === '\t';
}
