import { describe, expect, it } from 'vitest';

import { isTimelineViewportScrollbarPoint } from '../../src/panels/timeline-scrollbar';

const scrollableViewport = {
  clientWidth: 785,
  clientHeight: 385,
  offsetWidth: 800,
  offsetHeight: 400,
  scrollWidth: 1600,
  scrollHeight: 800,
};

describe('Timeline scrollbar hit testing', () => {
  it('recognizes the horizontal scrollbar gutter', () => {
    expect(isTimelineViewportScrollbarPoint(300, 392, scrollableViewport)).toBe(true);
  });

  it('recognizes the vertical scrollbar gutter', () => {
    expect(isTimelineViewportScrollbarPoint(792, 200, scrollableViewport)).toBe(true);
  });

  it('does not treat editable timeline content as a scrollbar', () => {
    expect(isTimelineViewportScrollbarPoint(300, 300, scrollableViewport)).toBe(false);
  });

  it('requires actual overflow before reserving a scrollbar gutter', () => {
    expect(isTimelineViewportScrollbarPoint(300, 392, {
      ...scrollableViewport,
      scrollWidth: scrollableViewport.clientWidth,
    })).toBe(false);
  });
});
