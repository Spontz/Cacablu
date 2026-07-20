import type { DbBar } from '../db/db-schema';
import type { NewTimelineBar } from '../db/db-session';
import type { BarClipboardPayload } from './cross-project-clipboard';

export function preparePastedTimelineBars(
  payload: BarClipboardPayload,
  targetTime: number,
  targetLayer: number,
  existingBars: DbBar[],
): NewTimelineBar[] {
  if (!Number.isFinite(targetTime) || targetTime < 0) {
    throw new Error('Select a valid non-negative Timeline time before pasting.');
  }
  if (!Number.isInteger(targetLayer) || targetLayer < 0) {
    throw new Error('Select a Timeline layer before pasting.');
  }

  const timeDelta = targetTime - payload.anchorStart;
  const layerDelta = targetLayer - payload.anchorLayer;
  const pasted = payload.bars.map((bar): NewTimelineBar => ({
    name: bar.name,
    type: bar.type,
    layer: bar.layer + layerDelta,
    startTime: bar.startTime + timeDelta,
    endTime: bar.endTime + timeDelta,
    enabled: bar.enabled,
    selected: false,
    script: bar.script,
    srcBlending: bar.srcBlending,
    dstBlending: bar.dstBlending,
    blendingEQ: bar.blendingEQ,
    srcAlpha: bar.srcAlpha,
    dstAlpha: bar.dstAlpha,
  }));

  for (const bar of pasted) {
    if (
      !Number.isInteger(bar.layer)
      || bar.layer < 0
      || !Number.isFinite(bar.startTime)
      || !Number.isFinite(bar.endTime)
      || bar.startTime < 0
      || bar.endTime <= bar.startTime
    ) {
      throw new Error('The copied bars cannot be placed at the selected Timeline target.');
    }
  }

  const occupied = [
    ...existingBars.map((bar) => ({
      layer: bar.layer,
      startTime: bar.startTime,
      endTime: bar.endTime,
    })),
  ];
  for (const bar of pasted) {
    if (occupied.some((other) => rangesOverlap(bar, other))) {
      throw new Error('The copied bars overlap an occupied Timeline range.');
    }
    occupied.push({
      layer: bar.layer,
      startTime: bar.startTime,
      endTime: bar.endTime,
    });
  }
  return pasted;
}

export function assertPastedBarsUnchanged(currentBars: DbBar[], pastedBars: DbBar[]): void {
  const currentById = new Map(currentBars.map((bar) => [bar.id, bar]));
  for (const pasted of pastedBars) {
    const current = currentById.get(pasted.id);
    if (!current || !barsEqual(current, pasted)) {
      throw new Error(`Cannot undo Timeline paste because bar ${pasted.id} has changed.`);
    }
  }
}

function rangesOverlap(
  left: Pick<NewTimelineBar, 'layer' | 'startTime' | 'endTime'>,
  right: Pick<NewTimelineBar, 'layer' | 'startTime' | 'endTime'>,
): boolean {
  return left.layer === right.layer
    && left.startTime < right.endTime
    && left.endTime > right.startTime;
}

function barsEqual(left: DbBar, right: DbBar): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.type === right.type
    && left.layer === right.layer
    && left.startTime === right.startTime
    && left.endTime === right.endTime
    && left.enabled === right.enabled
    && left.selected === right.selected
    && left.script === right.script
    && left.srcBlending === right.srcBlending
    && left.dstBlending === right.dstBlending
    && left.blendingEQ === right.blendingEQ
    && left.srcAlpha === right.srcAlpha
    && left.dstAlpha === right.dstAlpha;
}
