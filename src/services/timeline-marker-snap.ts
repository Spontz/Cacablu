export const TIMELINE_MARKER_SNAP_THRESHOLD_PX = 10;

export interface TimelineSnapMarker {
  id: number;
  time: number;
  enabled?: boolean;
}

export interface TimelineMarkerSnapTarget {
  id: number;
  time: number;
  distancePx: number;
}

export interface TimelineResizePlacement {
  id: number;
  startTime: number;
  endTime: number;
  layer: number;
}

export function buildTimelineEdgeResizePlacements(
  originals: readonly TimelineResizePlacement[],
  edge: 'start' | 'end',
  endpoint: number,
): TimelineResizePlacement[] {
  return originals.map((original) => ({
    ...original,
    startTime: edge === 'start' ? endpoint : original.startTime,
    endTime: edge === 'end' ? endpoint : original.endTime,
  }));
}

export function isValidTimelineResizePlacementSet(
  placements: readonly TimelineResizePlacement[],
  maxTime: number,
): boolean {
  return placements.length > 0 && placements.every((placement) => (
    Number.isFinite(placement.startTime)
    && Number.isFinite(placement.endTime)
    && placement.startTime >= 0
    && placement.endTime > placement.startTime
    && (maxTime === Number.POSITIVE_INFINITY || placement.endTime <= maxTime)
  ));
}

export function hasTimelineResizeOverlap(
  placements: readonly TimelineResizePlacement[],
  existing: readonly TimelineResizePlacement[],
): boolean {
  const resizingIds = new Set(placements.map((bar) => bar.id));
  if (placements.some((next) => existing.some((bar) => (
    !resizingIds.has(bar.id)
    && bar.layer === next.layer
    && next.startTime < bar.endTime
    && next.endTime > bar.startTime
  )))) {
    return true;
  }
  return placements.some((left, index) => placements.slice(index + 1).some((right) => (
    left.layer === right.layer
    && left.startTime < right.endTime
    && left.endTime > right.startTime
  )));
}

export function resolveTimelineMarkerSnap(
  markers: readonly TimelineSnapMarker[],
  pointerTime: number,
  pixelsPerSecond: number,
  minTime: number,
  maxTime: number,
  thresholdPx = TIMELINE_MARKER_SNAP_THRESHOLD_PX,
): TimelineMarkerSnapTarget | null {
  if (
    !Number.isFinite(pointerTime)
    || !Number.isFinite(pixelsPerSecond)
    || pixelsPerSecond <= 0
    || !Number.isFinite(minTime)
    || minTime < 0
    || (!Number.isFinite(maxTime) && maxTime !== Number.POSITIVE_INFINITY)
    || maxTime < minTime
    || !Number.isFinite(thresholdPx)
    || thresholdPx < 0
  ) {
    return null;
  }

  const candidates = markers.flatMap((marker): TimelineMarkerSnapTarget[] => {
    if (
      marker.enabled === false
      || !Number.isInteger(marker.id)
      || !Number.isFinite(marker.time)
      || marker.time < minTime
      || marker.time > maxTime
    ) {
      return [];
    }
    const distancePx = Math.abs(marker.time - pointerTime) * pixelsPerSecond;
    return distancePx <= thresholdPx + 1e-9 ? [{ id: marker.id, time: marker.time, distancePx }] : [];
  });

  candidates.sort((left, right) => (
    left.distancePx - right.distancePx
    || left.time - right.time
    || left.id - right.id
  ));
  return candidates[0] ?? null;
}
