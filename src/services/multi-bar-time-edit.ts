export interface BarTimePlacement {
  id: number;
  layer: number;
  startTime: number;
  endTime: number;
}

export type MultiBarTimeEditResult =
  | {
      ok: true;
      changed: boolean;
      startChanged: boolean;
      endChanged: boolean;
      placements: BarTimePlacement[];
    }
  | {
      ok: false;
      reason: 'invalid-range' | 'overlap';
    };

export function prepareMultiBarTimeEdit(
  selectedBars: readonly BarTimePlacement[],
  allBars: readonly BarTimePlacement[],
  requested: { startTime?: number; endTime?: number },
): MultiBarTimeEditResult {
  if (selectedBars.length === 0) return { ok: false, reason: 'invalid-range' };

  const startChanged = requested.startTime !== undefined;
  const endChanged = requested.endTime !== undefined;
  const placements = selectedBars.map((bar) => ({
    ...bar,
    startTime: requested.startTime ?? bar.startTime,
    endTime: requested.endTime ?? bar.endTime,
  }));

  if (!startChanged && !endChanged) {
    return { ok: true, changed: false, startChanged, endChanged, placements };
  }

  if (placements.some((bar) => (
    !Number.isFinite(bar.startTime)
    || !Number.isFinite(bar.endTime)
    || bar.startTime < 0
    || bar.endTime <= bar.startTime
  ))) {
    return { ok: false, reason: 'invalid-range' };
  }

  const selectedIds = new Set(placements.map((bar) => bar.id));
  const proposedProject = [
    ...allBars.filter((bar) => !selectedIds.has(bar.id)),
    ...placements,
  ];
  for (const left of placements) {
    for (const right of proposedProject) {
      if (
        left.id !== right.id
        && left.layer === right.layer
        && left.startTime < right.endTime
        && left.endTime > right.startTime
      ) {
        return { ok: false, reason: 'overlap' };
      }
    }
  }

  return {
    ok: true,
    changed: startChanged || endChanged,
    startChanged,
    endChanged,
    placements,
  };
}
