import { describe, expect, it } from 'vitest';

import { computeLoopIntervalFromMarkers } from '../../src/services/timeline-loop-markers';

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
});
