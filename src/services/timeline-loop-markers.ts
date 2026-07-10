import type { DbMarker } from '../db/db-schema';

export interface TimelineLoopInterval {
  startTime: number;
  endTime: number;
}

export function computeLoopIntervalFromMarkers(
  markers: Pick<DbMarker, 'time'>[],
  clickedTime: number,
  demoStart: number,
  demoEnd: number,
): TimelineLoopInterval | null {
  if (!Number.isFinite(clickedTime) || !Number.isFinite(demoStart) || !Number.isFinite(demoEnd) || demoEnd <= demoStart) {
    return null;
  }

  const sortedTimes = markers
    .map((marker) => marker.time)
    .filter((time) => Number.isFinite(time) && time > demoStart && time < demoEnd)
    .sort((left, right) => left - right);

  const boundedClick = Math.min(Math.max(clickedTime, demoStart), demoEnd);
  let startTime = demoStart;
  let endTime = demoEnd;

  for (const time of sortedTimes) {
    if (time <= boundedClick) {
      startTime = time;
      continue;
    }
    endTime = time;
    break;
  }

  return endTime > startTime ? { startTime, endTime } : null;
}
