export interface TimelineLayerSession {
  getLayers(barLayers: Iterable<number>): number[];
  addNext(barLayers: Iterable<number>): number;
  clear(): void;
}

export function canAddTimelineLayer(hasProject: boolean, timelinePanelOpen: boolean): boolean {
  return hasProject && timelinePanelOpen;
}

export function createTimelineLayerSession(): TimelineLayerSession {
  const addedLayers = new Set<number>();

  function getLayers(barLayers: Iterable<number>): number[] {
    const layers = new Set<number>(addedLayers);
    for (const layer of barLayers) {
      if (Number.isInteger(layer)) layers.add(layer);
    }
    return [...layers].sort((left, right) => left - right);
  }

  return {
    getLayers,
    addNext(barLayers): number {
      const layers = getLayers(barLayers);
      const nextLayer = layers.length === 0 ? 0 : Math.max(...layers) + 1;
      addedLayers.add(nextLayer);
      return nextLayer;
    },
    clear(): void {
      addedLayers.clear();
    },
  };
}
