import type { DbMarker } from '../db/db-schema';

export interface TimelineLoopInterval {
  startTime: number;
  endTime: number;
}

export function getTransportBeginningTime(loop: TimelineLoopInterval | null): number {
  return loop?.startTime ?? 0;
}

export function wrapTimeWithinLoop(time: number, loop: TimelineLoopInterval): number {
  const duration = loop.endTime - loop.startTime;
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return time;
  if (time < loop.startTime) return loop.startTime;
  if (time < loop.endTime) return time;
  return loop.startTime + ((time - loop.startTime) % duration);
}

export function computeLoopIntervalFromMarkers(
  markers: Array<Pick<DbMarker, 'time'> & Partial<Pick<DbMarker, 'enabled'>>>,
  clickedTime: number,
  demoStart: number,
  demoEnd: number,
): TimelineLoopInterval | null {
  if (!Number.isFinite(clickedTime) || !Number.isFinite(demoStart) || !Number.isFinite(demoEnd) || demoEnd <= demoStart) {
    return null;
  }

  const sortedTimes = markers
    .filter((marker) => marker.enabled !== false)
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
