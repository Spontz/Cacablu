import { describe, expect, it } from 'vitest';

import { computeLoopIntervalFromMarkers, wrapTimeWithinLoop } from '../../src/services/timeline-loop-markers';

describe('computeLoopIntervalFromMarkers', () => {
  it('uses nearest marker boundaries around the clicked time', () => {
    expect(computeLoopIntervalFromMarkers([
      { time: 20 },
      { time: 10 },
      { time: 40 },
    ], 15, 0, 60)).toEqual({ startTime: 10, endTime: 20 });
  });

  it('falls back to demo bounds outside marker range', () => {
    const markers = [{ time: 20 }];
    expect(computeLoopIntervalFromMarkers(markers, 5, 0, 60)).toEqual({ startTime: 0, endTime: 20 });
    expect(computeLoopIntervalFromMarkers(markers, 30, 0, 60)).toEqual({ startTime: 20, endTime: 60 });
  });

  it('uses the clicked marker as loop start and the next marker as loop end', () => {
    expect(computeLoopIntervalFromMarkers([{ time: 10 }, { time: 20 }], 10, 0, 60)).toEqual({ startTime: 10, endTime: 20 });
  });

  it('ignores markers outside demo bounds', () => {
    expect(computeLoopIntervalFromMarkers([{ time: -1 }, { time: 10 }, { time: 70 }], 30, 0, 60)).toEqual({ startTime: 10, endTime: 60 });
  });

  it('ignores disabled markers when choosing loop boundaries', () => {
    expect(computeLoopIntervalFromMarkers([
      { time: 10, enabled: true },
      { time: 20, enabled: false },
      { time: 30, enabled: true },
    ], 15, 0, 60)).toEqual({ startTime: 10, endTime: 30 });
  });

  it('falls back to demo bounds when disabled markers have no enabled neighbor', () => {
    expect(computeLoopIntervalFromMarkers([
      { time: 10, enabled: false },
      { time: 20, enabled: true },
      { time: 30, enabled: false },
    ], 15, 0, 60)).toEqual({ startTime: 0, endTime: 20 });
    expect(computeLoopIntervalFromMarkers([
      { time: 10, enabled: true },
      { time: 20, enabled: false },
    ], 15, 0, 60)).toEqual({ startTime: 10, endTime: 60 });
  });
});

describe('wrapTimeWithinLoop', () => {
  const loop = { startTime: 10, endTime: 20 };

  it('keeps times inside the active loop unchanged', () => {
    expect(wrapTimeWithinLoop(15, loop)).toBe(15);
  });

  it('wraps the loop end and later times back into the interval', () => {
    expect(wrapTimeWithinLoop(20, loop)).toBe(10);
    expect(wrapTimeWithinLoop(23, loop)).toBe(13);
    expect(wrapTimeWithinLoop(43, loop)).toBe(13);
  });

  it('clamps stale times before the loop to its start', () => {
    expect(wrapTimeWithinLoop(8, loop)).toBe(10);
  });
});
