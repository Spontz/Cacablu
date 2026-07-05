import type { IContentRenderer } from 'dockview-core';

import {
  createClip,
  createTimelineState,
  createTrack,
  normalizeRange,
} from '../../packages/timeline/src/index';
import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ConnectionController } from '../ws/connection';
import type { DbBar } from '../db/db-schema';
import type { UndoManager } from '../app/undo-manager';
import { createPhoenixSectionClient } from '../phoenix/section-client';
import { ProjectSectionSyncError, syncProjectBarToPhoenix } from '../services/project-section-sync';
import { createContentRenderer } from './base-panel';

const CLIP_COLOR = '#5e86b8';
const MIN_MARKER_LABEL_SPACING = 88;
const TRANSPORT_STEP_SECONDS = 1;
const DRAG_THRESHOLD_PX = 3;
const MOVE_SYNC_DELAY_MS = 850;
const TRANSPORT_SYNC_GRACE_MS = 1200;

interface BarDragState {
  pointerId: number;
  barId: number;
  startClientX: number;
  startClientY: number;
  originStart: number;
  originEnd: number;
  originLayer: number;
  duration: number;
  currentStart: number;
  currentEnd: number;
  currentLayer: number;
  hasMoved: boolean;
  blocked: boolean;
}

interface BoxSelectionState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  selectedIds: number[];
  hasMoved: boolean;
}

interface EmptyBarCreationState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  currentX: number;
  layer: number;
  hasMoved: boolean;
}

interface GroupBarDragState {
  pointerId: number;
  barIds: number[];
  startClientX: number;
  startClientY: number;
  originPointerLayer: number;
  currentTimeDelta: number;
  currentLayerDelta: number;
  originals: Array<{ id: number; startTime: number; endTime: number; layer: number }>;
  hasMoved: boolean;
  blocked: boolean;
}

export function createTimelinePanel(
  appState: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
  undoManager: UndoManager,
): IContentRenderer {
  const state = createTimelineState({
    duration: 0,
    currentTime: 0,
    loop: null,
    pixelsPerSecond: 88,
    zoom: 1,
  });

  let lastTimestamp = 0;
  let pendingPlayback: { playing: boolean; until: number } | null = null;
  let lastRenderedDuration = Number.NaN;
  let lastRenderedConnected = false;
  let lastRenderedSelectionSignature = '';
  let lastRenderedErrorSignature = '';
  let lastRenderedDisplayTimelineIds = false;
  let runtimeAnchorTime = state.transport.currentTime;
  let runtimeAnchorTimestamp = performance.now();
  let dragState: BarDragState | null = null;
  let groupDragState: GroupBarDragState | null = null;
  let boxSelectionState: BoxSelectionState | null = null;
  let emptyBarCreationState: EmptyBarCreationState | null = null;
  let suppressNextClick = false;
  let suppressNextClickTimeout: number | null = null;
  let moveSyncTimeout: number | null = null;
  const pendingMovedBarIds = new Set<number>();
  let suppressUndoRegistration = false;
  let renderTimeline: ((force?: boolean) => void) | null = null;
  const phoenixSections = createPhoenixSectionClient();

  function isProjectReady(): boolean {
    const status = dbState.getSnapshot().status;
    return Boolean(sessionRef.current && (status === 'open' || status === 'saving'));
  }

  function loadFromDb(options: { preserveTransport?: boolean } = {}): void {
    const db = sessionRef.current?.data ?? null;
    const previousCurrentTime = state.transport.currentTime;
    const previousIsPlaying = state.transport.isPlaying;

    state.tracks = [];
    state.clips = [];
    if (!options.preserveTransport) {
      state.transport.currentTime = 0;
      state.transport.isPlaying = false;
      lastTimestamp = 0;
      runtimeAnchorTime = 0;
      runtimeAnchorTimestamp = performance.now();
    }

    if (!db) return;

    const parsed = parseFloat(db.variables.get('endTime') ?? '');
    state.transport.duration = isFinite(parsed) && parsed > 0 ? parsed : 30;
    if (options.preserveTransport) {
      state.transport.currentTime = Math.min(
        Math.max(previousCurrentTime, 0),
        Math.max(state.transport.duration, 0),
      );
      state.transport.isPlaying = previousIsPlaying;
      lastTimestamp = 0;
      runtimeAnchorTime = state.transport.currentTime;
      runtimeAnchorTimestamp = performance.now();
    }

    const layerNums = [...new Set(db.bars.map((b) => b.layer))].sort((a, b) => a - b);

    state.tracks = layerNums.map((layer, index) =>
      createTrack({ id: `layer-${layer}`, label: `Layer ${layer}`, kind: 'generic', order: index, height: 18 }),
    );

    state.clips = db.bars.map((bar) =>
      createClip({
        id: `bar-${bar.id}`,
        trackId: `layer-${bar.layer}`,
        label: bar.name.trim(),
        start: bar.startTime,
        end: Math.max(bar.endTime, bar.startTime),
        metadata: { dbId: bar.id },
      }),
    );
  }

  function resetToEmptyProject(): void {
    state.tracks = [];
    state.clips = [];
    state.transport.duration = 0;
    state.transport.currentTime = 0;
    state.transport.isPlaying = false;
    state.transport.loop = null;
    lastTimestamp = 0;
    runtimeAnchorTime = 0;
    runtimeAnchorTimestamp = performance.now();
  }

  function formatTime(value: number): string {
    return Number.isFinite(value) ? trimMilliseconds(value) : '0';
  }

  function trimMilliseconds(value: number): string {
    return Number.parseFloat(value.toFixed(3)).toString();
  }

  function getMarkerStep(pixelsPerSecond: number): number {
    const minStepSeconds = MIN_MARKER_LABEL_SPACING / Math.max(pixelsPerSecond, 0.001);
    const magnitude = 10 ** Math.floor(Math.log10(minStepSeconds));

    for (const multiplier of [1, 2, 5, 10]) {
      const candidate = multiplier * magnitude;
      if (candidate >= minStepSeconds) {
        return candidate;
      }
    }

    return 10 * magnitude;
  }

  function normalizeTime(time: number): number {
    const range = state.transport.loop ? normalizeRange(state.transport.loop) : null;

    if (!range) {
      return Math.min(Math.max(time, 0), state.transport.duration);
    }

    const span = range.end - range.start;

    if (span <= 0) {
      return range.start;
    }

    const relative = (time - range.start) % span;
    return range.start + (relative < 0 ? relative + span : relative);
  }

  function getErroredSectionBarIds(): Set<number> {
    const ids = new Set<number>();
    for (const event of appState.getSnapshot().events) {
      if (
        event.severity !== 'error'
        || (event.source !== 'Phoenix section sync' && event.source !== 'Phoenix asset impact')
        || !event.subjectId
      ) {
        continue;
      }

      const id = Number(event.subjectId);
      if (Number.isInteger(id)) {
        ids.add(id);
      }
    }
    return ids;
  }

  function findBar(barId: number): DbBar | null {
    return sessionRef.current?.data.bars.find((bar) => bar.id === barId) ?? null;
  }

  function getLayerFromTrackId(trackId: string): number {
    const value = Number(trackId.replace(/^layer-/, ''));
    return Number.isFinite(value) ? value : 0;
  }

  function getLayerAtPoint(clientX: number, clientY: number, fallback: number): number {
    const target = document.elementFromPoint(clientX, clientY);
    const lane = target?.closest<HTMLElement>('.timeline-panel__lane');
    const layer = Number(lane?.dataset.layer);
    return Number.isFinite(layer) ? layer : fallback;
  }

  function getSelectedBarIds(): Set<number> {
    const selection = appState.getSnapshot().resourceSelection;
    if (selection.kind === 'bar') return new Set([selection.id]);
    if (selection.kind === 'bars') return new Set(selection.ids);
    return new Set();
  }

  function getSelectedBarIdList(): number[] {
    const selection = appState.getSnapshot().resourceSelection;
    if (selection.kind === 'bar') return [selection.id];
    if (selection.kind === 'bars') return [...selection.ids];
    return [];
  }

  function getSelectionSignature(ids: Set<number>): string {
    return [...ids].sort((a, b) => a - b).join(',');
  }

  function getTimelineContentPoint(viewport: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewport.getBoundingClientRect();
    return {
      x: clientX - rect.left + viewport.scrollLeft,
      y: clientY - rect.top + viewport.scrollTop,
    };
  }

  function getBoxSelectionRect(selection = boxSelectionState): { left: number; top: number; right: number; bottom: number } | null {
    if (!selection) return null;
    return {
      left: Math.min(selection.startX, selection.currentX),
      top: Math.min(selection.startY, selection.currentY),
      right: Math.max(selection.startX, selection.currentX),
      bottom: Math.max(selection.startY, selection.currentY),
    };
  }

  function getBoxSelectionStyle(): string {
    const rect = getBoxSelectionRect();
    if (!rect) return '';
    return `left:${rect.left}px;top:${rect.top}px;width:${rect.right - rect.left}px;height:${rect.bottom - rect.top}px`;
  }

  function getEmptyBarCreationRect(): { left: number; top: number; width: number; height: number } | null {
    const creation = emptyBarCreationState;
    if (!creation) return null;
    const track = state.tracks.find((candidate) => getLayerFromTrackId(candidate.id) === creation.layer);
    const lanes = document.querySelector<HTMLElement>('.timeline-panel__lanes');
    const viewport = document.querySelector<HTMLElement>('.timeline-panel__viewport');
    const lanesRect = lanes?.getBoundingClientRect();
    const viewportRect = viewport?.getBoundingClientRect();
    const lanesTop = lanesRect && viewportRect && viewport
      ? lanesRect.top - viewportRect.top + viewport.scrollTop
      : 0;
    const left = Math.min(creation.startX, creation.currentX);
    const right = Math.max(creation.startX, creation.currentX);
    return {
      left,
      top: getTrackTop(`layer-${creation.layer}`, lanesTop) + 2,
      width: Math.max(right - left, 1),
      height: Math.max((track?.height ?? 18) - 4, 1),
    };
  }

  function getEmptyBarCreationStyle(): string {
    const rect = getEmptyBarCreationRect();
    if (!rect) return '';
    return `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
  }

  function getTrackTop(trackId: string, lanesTop: number): number {
    let top = lanesTop;
    for (const track of state.tracks) {
      if (track.id === trackId) return top;
      top += track.height;
    }
    return top;
  }

  function collectBarsInSelectionRect(viewport: HTMLElement, selection = boxSelectionState): number[] {
    const rect = getBoxSelectionRect(selection);
    if (!rect || !selection) return [];
    const selected: number[] = [];
    const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
    if (!Number.isFinite(effectivePixelsPerSecond) || effectivePixelsPerSecond <= 0) {
      return selected;
    }

    const lanes = viewport.querySelector<HTMLElement>('.timeline-panel__lanes');
    const viewportRect = viewport.getBoundingClientRect();
    const lanesRect = lanes?.getBoundingClientRect();
    const lanesTop = lanesRect ? lanesRect.top - viewportRect.top + viewport.scrollTop : 0;

    for (const clip of state.clips) {
      const dbId = typeof clip.metadata?.dbId === 'number' ? clip.metadata.dbId : null;
      if (dbId === null) continue;

      const track = state.tracks.find((candidate) => candidate.id === clip.trackId);
      if (!track) continue;

      const left = clip.start * effectivePixelsPerSecond;
      const right = clip.end * effectivePixelsPerSecond;
      const top = getTrackTop(clip.trackId, lanesTop);
      const bottom = top + track.height;
      const matches = left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
      if (matches) selected.push(dbId);
    }

    return selected.sort((a, b) => a - b);
  }

  function wouldOverlap(barId: number, layer: number, startTime: number, endTime: number): boolean {
    const bars = sessionRef.current?.data.bars ?? [];
    return bars.some((bar) => (
      bar.id !== barId
      && bar.layer === layer
      && startTime < bar.endTime
      && endTime > bar.startTime
    ));
  }

  function wouldGroupOverlap(nextBars: Array<{ id: number; layer: number; startTime: number; endTime: number }>): boolean {
    const movingIds = new Set(nextBars.map((bar) => bar.id));
    const existing = sessionRef.current?.data.bars ?? [];
    return nextBars.some((next) => (
      existing.some((bar) => (
        !movingIds.has(bar.id)
        && bar.layer === next.layer
        && next.startTime < bar.endTime
        && next.endTime > bar.startTime
      ))
    ));
  }

  function hasValidGroupLayers(nextBars: Array<{ layer: number }>): boolean {
    const layers = new Set(state.tracks.map((track) => getLayerFromTrackId(track.id)));
    return nextBars.every((bar) => layers.has(bar.layer));
  }

  function findClipForBar(barId: number) {
    return state.clips.find((clip) => clip.metadata?.dbId === barId) ?? null;
  }

  function applyDragPreview(next: BarDragState): void {
    const clip = findClipForBar(next.barId);
    if (clip) {
      clip.start = next.currentStart;
      clip.end = next.currentEnd;
      clip.trackId = `layer-${next.currentLayer}`;
    }
  }

  function applyGroupDragPreview(next: GroupBarDragState, timeDelta: number, layerDelta: number): void {
    for (const original of next.originals) {
      const clip = findClipForBar(original.id);
      if (!clip) continue;
      clip.start = original.startTime + timeDelta;
      clip.end = original.endTime + timeDelta;
      clip.trackId = `layer-${original.layer + layerDelta}`;
    }
  }

  function restoreGroupDragPreview(previous: GroupBarDragState): void {
    for (const original of previous.originals) {
      const clip = findClipForBar(original.id);
      if (!clip) continue;
      clip.start = original.startTime;
      clip.end = original.endTime;
      clip.trackId = `layer-${original.layer}`;
    }
  }

  function restoreDragPreview(previous: BarDragState): void {
    const clip = findClipForBar(previous.barId);
    if (clip) {
      clip.start = previous.originStart;
      clip.end = previous.originEnd;
      clip.trackId = `layer-${previous.originLayer}`;
    }
  }

  function applyBarPlacement(bar: DbBar, startTime: number, endTime: number, layer: number): void {
    const session = sessionRef.current;
    if (!session) return;

    session.updateCell('bars', bar.id, 'startTime', startTime);
    session.updateCell('bars', bar.id, 'endTime', endTime);
    session.updateCell('bars', bar.id, 'layer', layer);
    bar.startTime = startTime;
    bar.endTime = endTime;
    bar.layer = layer;
  }

  function commitBarMove(next: BarDragState): boolean {
    const session = sessionRef.current;
    const bar = findBar(next.barId);
    if (!session || !bar) return false;
    if (
      bar.startTime === next.currentStart &&
      bar.endTime === next.currentEnd &&
      bar.layer === next.currentLayer
    ) {
      return false;
    }

    const previous = {
      startTime: bar.startTime,
      endTime: bar.endTime,
      layer: bar.layer,
    };
    const movedBarId = bar.id;
    applyBarPlacement(bar, next.currentStart, next.currentEnd, next.currentLayer);
    appState.setResourceSelection({ kind: 'bar', id: bar.id });
    if (!suppressUndoRegistration) {
      undoManager.push({
        label: `Move bar ${movedBarId}`,
        undo: async () => {
          const current = findBar(movedBarId);
          if (!current) return;
          if (wouldOverlap(movedBarId, previous.layer, previous.startTime, previous.endTime)) {
            appState.addEvent({
              severity: 'warning',
              source: 'Timeline undo',
              subjectId: String(movedBarId),
              description: `Could not undo move for bar ${movedBarId} because the original range is occupied.`,
            });
            return;
          }

          suppressUndoRegistration = true;
          try {
            applyBarPlacement(current, previous.startTime, previous.endTime, previous.layer);
          } finally {
            suppressUndoRegistration = false;
          }
          appState.setResourceSelection({ kind: 'bar', id: movedBarId });
          loadFromDb({ preserveTransport: true });
          renderTimeline?.(true);
          scheduleMovedBarSync(movedBarId, MOVE_SYNC_DELAY_MS);
        },
      });
    }
    scheduleMovedBarSync(bar.id, MOVE_SYNC_DELAY_MS);
    return true;
  }

  function commitGroupBarMove(next: GroupBarDragState): boolean {
    const bars = next.originals
      .map((original) => findBar(original.id))
      .filter((bar): bar is DbBar => Boolean(bar));
    if (bars.length !== next.originals.length || bars.length === 0) return false;

    const nextBars = next.originals.map((original) => ({
      id: original.id,
      startTime: original.startTime + next.currentTimeDelta,
      endTime: original.endTime + next.currentTimeDelta,
      layer: original.layer + next.currentLayerDelta,
    }));
    if (!hasValidGroupLayers(nextBars) || wouldGroupOverlap(nextBars)) return false;

    const changed = nextBars.some((bar) => {
      const original = next.originals.find((candidate) => candidate.id === bar.id);
      return Boolean(original && (
        original.startTime !== bar.startTime ||
        original.endTime !== bar.endTime ||
        original.layer !== bar.layer
      ));
    });
    if (!changed) return false;

    const previous = next.originals.map((original) => ({ ...original }));
    const movedIds = previous.map((bar) => bar.id);
    for (const target of nextBars) {
      const bar = findBar(target.id);
      if (bar) applyBarPlacement(bar, target.startTime, target.endTime, target.layer);
    }
    appState.setResourceSelection(movedIds.length === 1 ? { kind: 'bar', id: movedIds[0] } : { kind: 'bars', ids: movedIds });
    if (!suppressUndoRegistration) {
      undoManager.push({
        label: `Move ${movedIds.length} bars`,
        undo: async () => {
          if (wouldGroupOverlap(previous) || !hasValidGroupLayers(previous)) {
            appState.addEvent({
              severity: 'warning',
              source: 'Timeline undo',
              description: `Could not undo move for ${movedIds.length} bars because the original range is occupied.`,
            });
            return;
          }

          suppressUndoRegistration = true;
          try {
            for (const original of previous) {
              const bar = findBar(original.id);
              if (bar) applyBarPlacement(bar, original.startTime, original.endTime, original.layer);
            }
          } finally {
            suppressUndoRegistration = false;
          }
          appState.setResourceSelection(movedIds.length === 1 ? { kind: 'bar', id: movedIds[0] } : { kind: 'bars', ids: movedIds });
          loadFromDb({ preserveTransport: true });
          renderTimeline?.(true);
          scheduleMovedBarsSync(movedIds, MOVE_SYNC_DELAY_MS);
        },
      });
    }
    scheduleMovedBarsSync(movedIds, MOVE_SYNC_DELAY_MS);
    return true;
  }

  function scheduleMovedBarSync(barId: number, delayMs: number): void {
    scheduleMovedBarsSync([barId], delayMs);
  }

  function scheduleMovedBarsSync(barIds: number[], delayMs: number): void {
    for (const barId of barIds) {
      pendingMovedBarIds.add(barId);
    }
    if (moveSyncTimeout !== null) {
      window.clearTimeout(moveSyncTimeout);
    }
    moveSyncTimeout = window.setTimeout(() => {
      moveSyncTimeout = null;
      const barsToSync = [...pendingMovedBarIds];
      pendingMovedBarIds.clear();
      for (const barToSync of barsToSync) {
        void syncMovedBarToPhoenix(barToSync);
      }
    }, delayMs);
  }

  function deferMovedBarsSyncForTransport(): void {
    if (moveSyncTimeout !== null && pendingMovedBarIds.size > 0) {
      scheduleMovedBarsSync([...pendingMovedBarIds], TRANSPORT_SYNC_GRACE_MS);
    }
  }

  async function syncMovedBarToPhoenix(barId: number): Promise<void> {
    const session = sessionRef.current;
    if (!session) return;

    if (!connection.isConnected()) {
      return;
    }

    try {
      const result = await syncProjectBarToPhoenix(session.data, barId, phoenixSections);
      recordSectionIssues(result.issues);
    } catch (err) {
      if (err instanceof ProjectSectionSyncError) {
        recordSectionIssues(err.issues);
        return;
      }

      appState.addEvent({
        severity: 'error',
        source: 'Phoenix section sync',
        subjectId: String(barId),
        description: err instanceof Error ? err.message : 'Could not sync moved timeline bar to Phoenix.',
      });
    }
  }

  async function deleteBarsFromPhoenix(barIds: number[]): Promise<void> {
    if (!connection.isConnected() || barIds.length === 0) return;
    try {
      await phoenixSections.deleteMany(barIds.map(String));
    } catch (err) {
      appState.addEvent({
        severity: 'error',
        source: 'Phoenix section sync',
        description: err instanceof Error ? err.message : 'Could not delete timeline bars from Phoenix.',
      });
    }
  }

  function deleteSelectedBars(): boolean {
    const session = sessionRef.current;
    const selectedIds = getSelectedBarIdList();
    if (!session || selectedIds.length === 0) return false;

    const deletedBars = session.deleteTimelineBars(selectedIds);
    if (deletedBars.length === 0) return false;

    const deletedIds = deletedBars.map((bar) => bar.id);
    undoManager.push({
      label: `Delete ${deletedIds.length} bars`,
      undo: async () => {
        for (const bar of deletedBars.sort((a, b) => a.id - b.id)) {
          session.insertTimelineBar(bar);
        }
        appState.setResourceSelection(deletedIds.length === 1 ? { kind: 'bar', id: deletedIds[0] } : { kind: 'bars', ids: deletedIds });
        loadFromDb({ preserveTransport: true });
        renderTimeline?.(true);
        scheduleMovedBarsSync(deletedIds, MOVE_SYNC_DELAY_MS);
      },
    });

    appState.clearResourceSelection();
    loadFromDb({ preserveTransport: true });
    renderTimeline?.(true);
    void deleteBarsFromPhoenix(deletedIds);
    return true;
  }

  function recordSectionIssues(issues: ProjectSectionSyncError['issues']): void {
    if (issues.length === 0) return;
    appState.addEvents(issues.map((issue) => ({
      severity: 'error',
      source: 'Phoenix section sync',
      subjectId: String(issue.barId),
      description: issue.description,
    })));
  }

  function suppressUpcomingClick(): void {
    suppressNextClick = true;
    if (suppressNextClickTimeout !== null) {
      window.clearTimeout(suppressNextClickTimeout);
    }
    suppressNextClickTimeout = window.setTimeout(() => {
      suppressNextClick = false;
      suppressNextClickTimeout = null;
    }, 200);
  }

  function consumeSuppressedClick(): boolean {
    if (!suppressNextClick) return false;
    suppressNextClick = false;
    if (suppressNextClickTimeout !== null) {
      window.clearTimeout(suppressNextClickTimeout);
      suppressNextClickTimeout = null;
    }
    return true;
  }

  return createContentRenderer((element) => {
    element.className = 'panel panel--timeline';
    element.tabIndex = 0;

    const updatePlayhead = (): void => {
      const playhead = element.querySelector<HTMLElement>('.timeline-panel__playhead');
      if (!playhead) {
        return;
      }
      playhead.hidden = false;

      const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      const playheadLeft = state.transport.currentTime * state.viewport.pixelsPerSecond * state.viewport.zoom;
      playhead.style.left = `${playheadLeft}px`;
      if (viewport) {
        playhead.style.top = `${viewport.scrollTop}px`;
        playhead.style.height = `${viewport.clientHeight}px`;
      }

      const label = playhead.querySelector('span');
      if (label) {
        label.textContent = `${formatTime(state.transport.currentTime)}s`;
      }
    };

    const updateActiveClipStates = (): void => {
      const connected = connection.isConnected();
      const erroredBarIds = getErroredSectionBarIds();
      const clipsByBarId = new Map<number, { start: number; end: number }>();
      for (const clip of state.clips) {
        const dbId = typeof clip.metadata?.dbId === 'number' ? clip.metadata.dbId : null;
        if (dbId !== null) clipsByBarId.set(dbId, { start: clip.start, end: clip.end });
      }

      for (const clipElement of element.querySelectorAll<HTMLElement>('.timeline-panel__clip[data-bar-id]')) {
        const dbId = Number(clipElement.dataset.barId);
        const clip = Number.isInteger(dbId) ? clipsByBarId.get(dbId) : null;
        const isActive = Boolean(
          connected &&
          clip &&
          !erroredBarIds.has(dbId) &&
          state.transport.currentTime >= clip.start &&
          state.transport.currentTime < clip.end,
        );
        clipElement.classList.toggle('is-active', isActive);
      }
    };

    const updatePlaybackVisualState = (): void => {
      const panel = element.querySelector<HTMLElement>('.timeline-panel');
      panel?.classList.toggle('is-playing', state.transport.isPlaying);

      const playButton = element.querySelector<HTMLButtonElement>('[data-action="play"]');
      if (!playButton) {
        return;
      }

      const playTitle = state.transport.isPlaying ? 'Pause' : 'Play';
      playButton.title = playTitle;
      playButton.setAttribute('aria-label', playTitle);

      const icon = playButton.querySelector('svg');
      if (icon) {
        icon.innerHTML = state.transport.isPlaying
          ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z" />'
          : '<path d="M7 5v14l11-7z" />';
      }
    };

    const render = (force = false): void => {
      const transportDisabled = !connection.isConnected();
      const connected = !transportDisabled;
      const snapshot = appState.getSnapshot();
      const selectedBarIds = getSelectedBarIds();
      const boxSelectedBarIds = new Set(boxSelectionState?.selectedIds ?? []);
      const selectionSignature = getSelectionSignature(selectedBarIds);
      const displayTimelineIds = snapshot.displayTimelineIds;
      const erroredBarIds = getErroredSectionBarIds();
      const errorSignature = [...erroredBarIds].sort((a, b) => a - b).join(',');
      if (
        !force &&
        state.transport.duration === lastRenderedDuration &&
        connected === lastRenderedConnected &&
        selectionSignature === lastRenderedSelectionSignature &&
        errorSignature === lastRenderedErrorSignature &&
        displayTimelineIds === lastRenderedDisplayTimelineIds
      ) {
        updatePlaybackVisualState();
        updatePlayhead();
        updateActiveClipStates();
        return;
      }

      lastRenderedDuration = state.transport.duration;
      lastRenderedConnected = connected;
      lastRenderedSelectionSignature = selectionSignature;
      lastRenderedErrorSignature = errorSignature;
      lastRenderedDisplayTimelineIds = displayTimelineIds;

      const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
      const playTitle = state.transport.isPlaying ? 'Pause' : 'Play';
      const previousViewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      const previousScrollLeft = previousViewport?.scrollLeft ?? 0;
      const previousScrollTop = previousViewport?.scrollTop ?? 0;
      const viewportWidth = previousViewport?.clientWidth ?? element.clientWidth;
      const playheadLeft = state.transport.currentTime * effectivePixelsPerSecond;
      const timelineWidth = Math.max(state.transport.duration * effectivePixelsPerSecond, viewportWidth);
      const markerStep = getMarkerStep(effectivePixelsPerSecond);
      const markerCount = Math.floor(state.transport.duration / markerStep) + 1;

      element.innerHTML = `
        <div class="timeline-panel ${state.transport.isPlaying ? 'is-playing' : ''}">
          <div class="timeline-panel__body">
            <div class="timeline-panel__viewport">
              <div class="timeline-panel__ruler" style="width:${timelineWidth}px">
                ${Array.from({ length: markerCount }, (_, index) => {
                  const time = index * markerStep;
                  const left = time * effectivePixelsPerSecond;
                  return `<span class="timeline-panel__marker" style="left:${left}px"><i>${formatTime(time)}s</i></span>`;
                }).join('')}
              </div>

              <div class="timeline-panel__grid" style="width:${timelineWidth}px">
                ${Array.from({ length: markerCount }, (_, index) => {
                  const left = index * markerStep * effectivePixelsPerSecond;
                  return `<span class="timeline-panel__grid-line" style="left:${left}px"></span>`;
                }).join('')}
              </div>

              <div class="timeline-panel__playhead" style="left:${playheadLeft}px">
                <span>${formatTime(state.transport.currentTime)}s</span>
              </div>
              ${boxSelectionState?.hasMoved
                ? `<div class="timeline-panel__selection-box" style="${getBoxSelectionStyle()}"></div>`
                : ''}
              ${emptyBarCreationState?.hasMoved
                ? `<div class="timeline-panel__new-bar-preview" style="${getEmptyBarCreationStyle()}"></div>`
                : ''}

              <div class="timeline-panel__lanes" style="width:${timelineWidth}px">
                ${state.tracks
                  .map((track) => {
                    const trackClips = state.clips
                      .filter((clip) => clip.trackId === track.id)
                      .sort((a, b) => a.start - b.start);

                    return `
                      <div class="timeline-panel__lane" data-layer="${getLayerFromTrackId(track.id)}" style="height:${track.height}px">
                        ${trackClips
                          .map((clip) => {
                            const left = clip.start * state.viewport.pixelsPerSecond * state.viewport.zoom;
                            const rawWidth = Math.max((clip.end - clip.start) * state.viewport.pixelsPerSecond * state.viewport.zoom, 0);
                            const width = Math.max(rawWidth - 1, 1);
                            const isCompact = rawWidth < 8;
                            const dbId = typeof clip.metadata?.dbId === 'number' ? clip.metadata.dbId : null;
                            const isBoxSelected = dbId !== null && boxSelectedBarIds.has(dbId);
                            const isSelected = dbId !== null && (selectedBarIds.has(dbId) || isBoxSelected);
                            const isMovable = dbId !== null && (
                              (snapshot.resourceSelection.kind === 'bar' && snapshot.resourceSelection.id === dbId) ||
                              (snapshot.resourceSelection.kind === 'bars' && snapshot.resourceSelection.ids.includes(dbId))
                            );
                            const hasError = dbId !== null && erroredBarIds.has(dbId);
                            const isActive =
                              connected &&
                              !hasError &&
                              state.transport.currentTime >= clip.start &&
                              state.transport.currentTime < clip.end;
                            const isDragging = dbId !== null && (dragState?.barId === dbId || groupDragState?.barIds.includes(dbId));
                            const isBlocked = isDragging && (dragState?.blocked || groupDragState?.blocked);
                            const label = displayTimelineIds && dbId !== null && clip.label ? `${dbId} ${clip.label}` : clip.label;

                            return `
                              <article class="timeline-panel__clip ${isActive ? 'is-active' : ''} ${isCompact ? 'is-compact' : ''} ${isSelected ? 'is-selected' : ''} ${isBoxSelected ? 'is-box-selected' : ''} ${isMovable ? 'is-movable' : ''} ${hasError ? 'has-error' : ''} ${isDragging ? 'is-dragging' : ''} ${isBlocked ? 'is-blocked' : ''}" data-bar-id="${dbId ?? ''}" tabindex="0" style="left:${left}px;width:${width}px;border-color:${clip.color ?? CLIP_COLOR}">
                                <span class="timeline-panel__clip-label">${label}</span>
                              </article>
                            `;
                          })
                          .join('')}
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          </div>

          <footer class="timeline-panel__transport-bar">
            <button data-action="start" title="Go to beginning" aria-label="Go to beginning" ${transportDisabled ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 5h2v14H6zM18 5L8 12l10 7V5z" />
              </svg>
            </button>
            <button data-action="rewind" title="Rewind" aria-label="Rewind" ${transportDisabled ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19 5 9 12l10 7V5zM11 5 1 12l10 7V5z" />
              </svg>
            </button>
            <button data-action="play" class="timeline-panel__transport-main" title="${playTitle}" aria-label="${playTitle}" ${transportDisabled ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                ${state.transport.isPlaying
                  ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z" />'
                  : '<path d="M7 5v14l11-7z" />'}
              </svg>
            </button>
            <button data-action="forward" title="Forward" aria-label="Forward" ${transportDisabled ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M13 5 23 12 13 19V5zM5 5 15 12 5 19V5z" />
              </svg>
            </button>
            <button data-action="end" title="Go to end" aria-label="Go to end" ${transportDisabled ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M16 5h2v14h-2zM6 5v14l10-7z" />
              </svg>
            </button>
          </footer>
        </div>
      `;

      const nextViewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      if (nextViewport) {
        nextViewport.scrollLeft = previousScrollLeft;
        nextViewport.scrollTop = previousScrollTop;
      }
      updatePlayhead();
      updateActiveClipStates();
    };
    renderTimeline = render;

    const handleAction = (action: string): void => {
      deferMovedBarsSyncForTransport();

      if (!connection.isConnected()) {
        render();
        return;
      }

      if (action === 'play') {
        const shouldPlay = !state.transport.isPlaying;
        if (connection.send({ type: 'runtime.toggle' })) {
          pendingPlayback = { playing: shouldPlay, until: Date.now() + 1000 };
        }
        return;
      }

      if (action === 'start') {
        runtimeAnchorTime = 0;
        runtimeAnchorTimestamp = performance.now();
        state.transport.currentTime = 0;
        updatePlayhead();
        connection.send({ type: 'runtime.seek', time: 0 });
        return;
      }

      if (action === 'rewind') {
        const time = Math.max(state.transport.currentTime - TRANSPORT_STEP_SECONDS, 0);
        runtimeAnchorTime = time;
        runtimeAnchorTimestamp = performance.now();
        state.transport.currentTime = time;
        updatePlayhead();
        connection.send({ type: 'runtime.seek', time });
        return;
      }

      if (action === 'forward') {
        const time = Math.min(state.transport.currentTime + TRANSPORT_STEP_SECONDS, state.transport.duration);
        runtimeAnchorTime = time;
        runtimeAnchorTimestamp = performance.now();
        state.transport.currentTime = time;
        updatePlayhead();
        connection.send({ type: 'runtime.seek', time });
        return;
      }

      if (action === 'end') {
        runtimeAnchorTime = state.transport.duration;
        runtimeAnchorTimestamp = performance.now();
        state.transport.currentTime = state.transport.duration;
        updatePlayhead();
        connection.send({ type: 'runtime.seek', time: state.transport.duration });
      }
    };

    const tick = (timestamp: number): void => {
      if (connection.isConnected()) {
        if (state.transport.isPlaying) {
          const elapsedSeconds = (performance.now() - runtimeAnchorTimestamp) / 1000;
          state.transport.currentTime = Math.min(
            Math.max(runtimeAnchorTime + elapsedSeconds * state.transport.playbackRate, 0),
            state.transport.duration,
          );
          updatePlayhead();
        }

        lastTimestamp = 0;
        requestAnimationFrame(tick);
        return;
      }

      if (!state.transport.isPlaying) {
        lastTimestamp = 0;
        requestAnimationFrame(tick);
        return;
      }

      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const elapsedSeconds = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      state.transport.currentTime = normalizeTime(
        state.transport.currentTime + elapsedSeconds * state.transport.playbackRate,
      );

      render();
      requestAnimationFrame(tick);
    };

    dbState.subscribe((snapshot) => {
      if (snapshot.status === 'open') {
        loadFromDb();
        render(true);
        return;
      } else if (!isProjectReady()) {
        resetToEmptyProject();
        render(true);
        return;
      }
      render();
    });

    connection.subscribeRuntime((runtime) => {
      const duration = runtime.endTime !== null && runtime.endTime > 0 ? runtime.endTime : state.transport.duration;

      state.transport.currentTime = Math.min(Math.max(runtime.time, 0), Math.max(duration, 0));
      runtimeAnchorTime = state.transport.currentTime;
      runtimeAnchorTimestamp = performance.now();

      if (runtime.playing !== null) {
        if (
          pendingPlayback &&
          runtime.playing !== pendingPlayback.playing &&
          Date.now() < pendingPlayback.until
        ) {
          return;
        }

        if (pendingPlayback && runtime.playing === pendingPlayback.playing) {
          pendingPlayback = null;
        }

        state.transport.isPlaying = runtime.playing;
        if (!runtime.playing) {
          runtimeAnchorTime = state.transport.currentTime;
          runtimeAnchorTimestamp = performance.now();
        }
      }

      if (runtime.endTime !== null && runtime.endTime > 0) {
        state.transport.duration = runtime.endTime;
      }

      render();
    });

    appState.subscribe(() => {
      render();
    });

    render();
    requestAnimationFrame(tick);

    function beginDrag(event: PointerEvent): void {
      if (event.button !== 0 || !isProjectReady()) {
        return;
      }

      const clip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-bar-id]');
      if (!clip?.dataset.barId) {
        if (event.shiftKey) {
          beginBoxSelection(event);
        } else {
          beginEmptyBarCreation(event);
        }
        return;
      }

      const barId = Number(clip.dataset.barId);
      const selection = appState.getSnapshot().resourceSelection;
      if (!Number.isInteger(barId)) {
        return;
      }

      const bar = findBar(barId);
      if (!bar) return;

      if (selection.kind === 'bars' && selection.ids.includes(barId)) {
        const originals = selection.ids
          .map((id) => findBar(id))
          .filter((selectedBar): selectedBar is DbBar => Boolean(selectedBar))
          .map((selectedBar) => ({
            id: selectedBar.id,
            startTime: selectedBar.startTime,
            endTime: selectedBar.endTime,
            layer: selectedBar.layer,
          }));
        if (originals.length === 0) return;

        groupDragState = {
          pointerId: event.pointerId,
          barIds: originals.map((original) => original.id),
          startClientX: event.clientX,
          startClientY: event.clientY,
          originPointerLayer: bar.layer,
          currentTimeDelta: 0,
          currentLayerDelta: 0,
          originals,
          hasMoved: false,
          blocked: false,
        };
        clip.setPointerCapture(event.pointerId);
        return;
      }

      if (selection.kind !== 'bar' || selection.id !== barId) {
        return;
      }

      dragState = {
        pointerId: event.pointerId,
        barId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originStart: bar.startTime,
        originEnd: bar.endTime,
        originLayer: bar.layer,
        duration: Math.max(bar.endTime - bar.startTime, 0),
        currentStart: bar.startTime,
        currentEnd: bar.endTime,
        currentLayer: bar.layer,
        hasMoved: false,
        blocked: false,
      };
      clip.setPointerCapture(event.pointerId);
    }

    function beginBoxSelection(event: PointerEvent): void {
      const target = event.target as HTMLElement | null;
      const viewport = target?.closest<HTMLElement>('.timeline-panel__viewport');
      if (!viewport || target?.closest('[data-action], .timeline-panel__ruler')) {
        return;
      }

      const point = getTimelineContentPoint(viewport, event.clientX, event.clientY);
      boxSelectionState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        selectedIds: [],
        hasMoved: false,
      };
      viewport.setPointerCapture(event.pointerId);
    }

    function beginEmptyBarCreation(event: PointerEvent): void {
      const target = event.target as HTMLElement | null;
      const viewport = target?.closest<HTMLElement>('.timeline-panel__viewport');
      if (!viewport || target?.closest('[data-action], .timeline-panel__ruler')) {
        return;
      }

      const point = getTimelineContentPoint(viewport, event.clientX, event.clientY);
      emptyBarCreationState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        currentX: point.x,
        layer: getLayerAtPoint(event.clientX, event.clientY, 0),
        hasMoved: false,
      };
      viewport.setPointerCapture(event.pointerId);
    }

    function updateDrag(event: PointerEvent): void {
      if (boxSelectionState && event.pointerId === boxSelectionState.pointerId) {
        updateBoxSelection(event);
        return;
      }

      if (emptyBarCreationState && event.pointerId === emptyBarCreationState.pointerId) {
        updateEmptyBarCreation(event);
        return;
      }

      if (groupDragState && event.pointerId === groupDragState.pointerId) {
        updateGroupDrag(event);
        return;
      }

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      if (!dragState.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }

      event.preventDefault();
      const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
      if (!Number.isFinite(effectivePixelsPerSecond) || effectivePixelsPerSecond <= 0 || dragState.duration <= 0) {
        return;
      }

      dragState.hasMoved = true;
      const targetLayer = getLayerAtPoint(event.clientX, event.clientY, dragState.originLayer);
      let nextStart = dragState.originStart + deltaX / effectivePixelsPerSecond;
      nextStart = Math.max(0, nextStart);
      if (state.transport.duration > 0) {
        nextStart = Math.min(nextStart, Math.max(0, state.transport.duration - dragState.duration));
      }
      const nextEnd = nextStart + dragState.duration;

      if (wouldOverlap(dragState.barId, targetLayer, nextStart, nextEnd)) {
        dragState.blocked = true;
        render(true);
        return;
      }

      dragState.currentStart = nextStart;
      dragState.currentEnd = nextEnd;
      dragState.currentLayer = targetLayer;
      dragState.blocked = false;
      applyDragPreview(dragState);
      render(true);
    }

    function updateGroupDrag(event: PointerEvent): void {
      if (!groupDragState) return;

      const deltaX = event.clientX - groupDragState.startClientX;
      const deltaY = event.clientY - groupDragState.startClientY;
      if (!groupDragState.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }

      event.preventDefault();
      const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
      if (!Number.isFinite(effectivePixelsPerSecond) || effectivePixelsPerSecond <= 0) {
        return;
      }

      const targetLayer = getLayerAtPoint(event.clientX, event.clientY, groupDragState.originPointerLayer);
      const layerDelta = targetLayer - groupDragState.originPointerLayer;
      const minStart = Math.min(...groupDragState.originals.map((bar) => bar.startTime));
      const maxEnd = Math.max(...groupDragState.originals.map((bar) => bar.endTime));
      let timeDelta = deltaX / effectivePixelsPerSecond;
      timeDelta = Math.max(timeDelta, -minStart);
      if (state.transport.duration > 0) {
        timeDelta = Math.min(timeDelta, Math.max(0, state.transport.duration - maxEnd));
      }

      const nextBars = groupDragState.originals.map((bar) => ({
        id: bar.id,
        startTime: bar.startTime + timeDelta,
        endTime: bar.endTime + timeDelta,
        layer: bar.layer + layerDelta,
      }));

      groupDragState.hasMoved = true;
      groupDragState.currentTimeDelta = timeDelta;
      groupDragState.currentLayerDelta = layerDelta;
      if (!hasValidGroupLayers(nextBars) || wouldGroupOverlap(nextBars)) {
        groupDragState.blocked = true;
        render(true);
        return;
      }

      groupDragState.blocked = false;
      applyGroupDragPreview(groupDragState, timeDelta, layerDelta);
      render(true);
    }

    function updateBoxSelection(event: PointerEvent): void {
      if (!boxSelectionState) return;

      const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      if (!viewport) return;

      const deltaX = event.clientX - boxSelectionState.startClientX;
      const deltaY = event.clientY - boxSelectionState.startClientY;
      if (!boxSelectionState.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }

      event.preventDefault();
      const point = getTimelineContentPoint(viewport, event.clientX, event.clientY);
      boxSelectionState.currentX = point.x;
      boxSelectionState.currentY = point.y;
      boxSelectionState.hasMoved = true;
      boxSelectionState.selectedIds = collectBarsInSelectionRect(viewport, boxSelectionState);
      render(true);
    }

    function updateEmptyBarCreation(event: PointerEvent): void {
      if (!emptyBarCreationState) return;

      const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      if (!viewport) return;

      const deltaX = event.clientX - emptyBarCreationState.startClientX;
      const deltaY = event.clientY - emptyBarCreationState.startClientY;
      if (!emptyBarCreationState.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }

      event.preventDefault();
      const point = getTimelineContentPoint(viewport, event.clientX, event.clientY);
      emptyBarCreationState.currentX = Math.max(0, point.x);
      emptyBarCreationState.hasMoved = true;
      render(true);
    }

    function endDrag(event: PointerEvent): void {
      if (boxSelectionState && event.pointerId === boxSelectionState.pointerId) {
        endBoxSelection();
        return;
      }

      if (emptyBarCreationState && event.pointerId === emptyBarCreationState.pointerId) {
        endEmptyBarCreation();
        return;
      }

      if (groupDragState && event.pointerId === groupDragState.pointerId) {
        endGroupDrag();
        return;
      }

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const finishedDrag = dragState;
      dragState = null;
      if (!finishedDrag.hasMoved) {
        return;
      }

      suppressUpcomingClick();
      if (!commitBarMove(finishedDrag)) {
        restoreDragPreview(finishedDrag);
      }
      loadFromDb({ preserveTransport: true });
      render(true);
    }

    function endGroupDrag(): void {
      const finishedDrag = groupDragState;
      groupDragState = null;
      if (!finishedDrag?.hasMoved) {
        return;
      }

      suppressUpcomingClick();
      if (!commitGroupBarMove(finishedDrag)) {
        restoreGroupDragPreview(finishedDrag);
      }
      loadFromDb({ preserveTransport: true });
      render(true);
    }

    function endBoxSelection(): void {
      const finishedSelection = boxSelectionState;
      if (!finishedSelection?.hasMoved) {
        boxSelectionState = null;
        return;
      }

      const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      if (!viewport) {
        boxSelectionState = null;
        return;
      }

      suppressUpcomingClick();
      const selectedIds = finishedSelection.selectedIds.length > 0
        ? finishedSelection.selectedIds
        : collectBarsInSelectionRect(viewport, finishedSelection);
      boxSelectionState = null;
      if (selectedIds.length === 0) {
        appState.clearResourceSelection();
      } else if (selectedIds.length === 1) {
        appState.setResourceSelection({ kind: 'bar', id: selectedIds[0] });
      } else {
        appState.setResourceSelection({ kind: 'bars', ids: selectedIds });
      }
      render(true);
    }

    function endEmptyBarCreation(): void {
      const finishedCreation = emptyBarCreationState;
      emptyBarCreationState = null;
      if (!finishedCreation?.hasMoved) {
        return;
      }

      const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
      if (!Number.isFinite(effectivePixelsPerSecond) || effectivePixelsPerSecond <= 0) {
        render(true);
        return;
      }

      const left = Math.max(0, Math.min(finishedCreation.startX, finishedCreation.currentX));
      const right = Math.max(0, Math.max(finishedCreation.startX, finishedCreation.currentX));
      const startTime = left / effectivePixelsPerSecond;
      const endTime = right / effectivePixelsPerSecond;
      if (endTime <= startTime || wouldOverlap(-1, finishedCreation.layer, startTime, endTime)) {
        render(true);
        return;
      }

      const session = sessionRef.current;
      if (!session) {
        render(true);
        return;
      }

      const bar = session.insertTimelineBar({
        layer: finishedCreation.layer,
        startTime,
        endTime,
        type: '',
        script: '',
      });
      suppressUpcomingClick();
      appState.setResourceSelection({ kind: 'bar', id: bar.id });
      loadFromDb({ preserveTransport: true });
      render(true);
    }

    element.addEventListener('pointerdown', beginDrag);
    element.addEventListener('pointermove', updateDrag);
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (deleteSelectedBars()) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    const handleDeleteAction = (event: Event): void => {
      if (deleteSelectedBars()) {
        event.preventDefault();
      }
    };
    window.addEventListener('cacablu:edit-delete', handleDeleteAction);

    const handleBarsChanged = (): void => {
      loadFromDb({ preserveTransport: true });
      render(true);
    };
    window.addEventListener('cacablu:timeline-bars-changed', handleBarsChanged);

    const handleTimelineScroll = (event: Event): void => {
      if ((event.target as HTMLElement | null)?.classList.contains('timeline-panel__viewport')) {
        updatePlayhead();
      }
    };
    element.addEventListener('scroll', handleTimelineScroll, true);

    element.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
      if (!target) {
        return;
      }

      handleAction(target.dataset.action ?? '');
    });

    element.addEventListener('click', (event) => {
      if (consumeSuppressedClick()) {
        event.stopImmediatePropagation();
        return;
      }

      if ((event.target as HTMLElement | null)?.closest('[data-action]')) {
        return;
      }

      const clip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-bar-id]');
      if (clip?.dataset.barId) {
        const barId = Number(clip.dataset.barId);
        if (Number.isInteger(barId)) {
          appState.setResourceSelection({ kind: 'bar', id: barId });
        }
        return;
      }

      if ((event.target as HTMLElement | null)?.closest('.timeline-panel__viewport')) {
        appState.clearResourceSelection();
      }
    });

    element.addEventListener(
      'wheel',
      (event) => {
        if (!event.shiftKey) {
          return;
        }

        const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
        if (!viewport) {
          return;
        }

        event.preventDefault();

        const zoomFactor = event.deltaY > 0 ? 1 / 1.12 : 1.12;
        const nextZoom = state.viewport.zoom * zoomFactor;

        if (!Number.isFinite(nextZoom) || nextZoom <= 0 || nextZoom === state.viewport.zoom) {
          return;
        }

        const before = (viewport.scrollLeft + event.clientX - viewport.getBoundingClientRect().left) /
          (state.viewport.pixelsPerSecond * state.viewport.zoom);

        state.viewport.zoom = nextZoom;
        render(true);

        requestAnimationFrame(() => {
          const refreshedViewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
          if (!refreshedViewport) {
            return;
          }

          refreshedViewport.scrollLeft =
            before * state.viewport.pixelsPerSecond * state.viewport.zoom -
            (event.clientX - refreshedViewport.getBoundingClientRect().left);
        });
      },
      { passive: false },
    );

    element.addEventListener('click', (event) => {
      if (consumeSuppressedClick()) {
        event.stopImmediatePropagation();
        return;
      }

      const ruler = (event.target as HTMLElement | null)?.closest<HTMLElement>('.timeline-panel__ruler');
      if (!ruler) {
        return;
      }

      const viewport = element.querySelector<HTMLElement>('.timeline-panel__viewport');
      if (!viewport) {
        return;
      }

      const bounds = viewport.getBoundingClientRect();
      const x = event.clientX - bounds.left + viewport.scrollLeft;
      const nextTime = Math.min(
        Math.max(x / (state.viewport.pixelsPerSecond * state.viewport.zoom), 0),
        state.transport.duration,
      );

      state.transport.currentTime = nextTime;
      runtimeAnchorTime = nextTime;
      runtimeAnchorTimestamp = performance.now();
      if (connection.isConnected()) {
        connection.send({ type: 'runtime.seek', time: nextTime });
      }
      render();
    });

    return () => {
      if (moveSyncTimeout !== null) {
        window.clearTimeout(moveSyncTimeout);
        moveSyncTimeout = null;
      }
      if (suppressNextClickTimeout !== null) {
        window.clearTimeout(suppressNextClickTimeout);
        suppressNextClickTimeout = null;
      }
      pendingMovedBarIds.clear();
      window.removeEventListener('cacablu:edit-delete', handleDeleteAction);
      window.removeEventListener('cacablu:timeline-bars-changed', handleBarsChanged);
      element.removeEventListener('scroll', handleTimelineScroll, true);
      renderTimeline = null;
    };
  });
}
