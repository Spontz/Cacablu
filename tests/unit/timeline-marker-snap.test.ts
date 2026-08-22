import { describe, expect, it } from 'vitest';

import {
  buildTimelineEdgeResizePlacements,
  hasTimelineResizeOverlap,
  isValidTimelineResizePlacementSet,
  resolveTimelineMarkerSnap,
  TIMELINE_MARKER_SNAP_THRESHOLD_PX,
} from '../../src/services/timeline-marker-snap';

describe('Timeline marker resize snap', () => {
  it('selects an enabled marker inside the inclusive 10px threshold', () => {
    expect(resolveTimelineMarkerSnap(
      [{ id: 7, time: 5, enabled: true }],
      4,
      10,
      0,
      20,
    )).toEqual({ id: 7, time: 5, distancePx: 10 });
    expect(TIMELINE_MARKER_SNAP_THRESHOLD_PX).toBe(10);
  });

  it('keeps the threshold in screen space across zoom scales', () => {
    const markers = [{ id: 2, time: 5, enabled: true }];
    expect(resolveTimelineMarkerSnap(markers, 4.8, 50, 0, 20)?.id).toBe(2);
    expect(resolveTimelineMarkerSnap(markers, 4.8, 100, 0, 20)).toBeNull();
  });

  it('ignores disabled, non-finite, and out-of-bounds markers', () => {
    expect(resolveTimelineMarkerSnap([
      { id: 1, time: 5, enabled: false },
      { id: 2, time: Number.NaN, enabled: true },
      { id: 3, time: 21, enabled: true },
    ], 5, 100, 0, 20)).toBeNull();
  });

  it('orders ties by earlier time and then lower id', () => {
    expect(resolveTimelineMarkerSnap([
      { id: 9, time: 5.1 },
      { id: 8, time: 4.9 },
    ], 5, 50, 0, 20)?.id).toBe(8);
    expect(resolveTimelineMarkerSnap([
      { id: 9, time: 5 },
      { id: 3, time: 5 },
    ], 5, 50, 0, 20)?.id).toBe(3);
  });

  it('returns no target for invalid geometry inputs or distant markers', () => {
    const markers = [{ id: 1, time: 5 }];
    expect(resolveTimelineMarkerSnap(markers, 4, 100, 0, 20)).toBeNull();
    expect(resolveTimelineMarkerSnap(markers, 5, 0, 0, 20)).toBeNull();
    expect(resolveTimelineMarkerSnap(markers, Number.NaN, 100, 0, 20)).toBeNull();
  });

  it('assigns one common endpoint while preserving every opposite endpoint', () => {
    const originals = [
      { id: 1, startTime: 1, endTime: 6, layer: 0 },
      { id: 2, startTime: 2, endTime: 8, layer: 1 },
    ];
    expect(buildTimelineEdgeResizePlacements(originals, 'start', 4)).toEqual([
      { id: 1, startTime: 4, endTime: 6, layer: 0 },
      { id: 2, startTime: 4, endTime: 8, layer: 1 },
    ]);
    expect(buildTimelineEdgeResizePlacements(originals, 'end', 10)).toEqual([
      { id: 1, startTime: 1, endTime: 10, layer: 0 },
      { id: 2, startTime: 2, endTime: 10, layer: 1 },
    ]);
  });

  it('validates a resize set atomically and detects internal or external overlap', () => {
    const valid = [
      { id: 1, startTime: 1, endTime: 4, layer: 0 },
      { id: 2, startTime: 4, endTime: 7, layer: 0 },
    ];
    expect(isValidTimelineResizePlacementSet(valid, 10)).toBe(true);
    expect(isValidTimelineResizePlacementSet([
      ...valid,
      { id: 3, startTime: 8, endTime: 8, layer: 2 },
    ], 10)).toBe(false);
    expect(hasTimelineResizeOverlap(valid, valid)).toBe(false);
    expect(hasTimelineResizeOverlap([
      { id: 1, startTime: 1, endTime: 5, layer: 0 },
      { id: 2, startTime: 4, endTime: 7, layer: 0 },
    ], [])).toBe(true);
    expect(hasTimelineResizeOverlap(valid, [
      ...valid,
      { id: 9, startTime: 3, endTime: 5, layer: 0 },
    ])).toBe(true);
  });
});
