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
import { createContentRenderer } from './base-panel';

const CLIP_COLOR = '#5e86b8';
const MIN_MARKER_LABEL_SPACING = 88;
const TRANSPORT_STEP_SECONDS = 1;

export function createTimelinePanel(
  appState: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
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
  let lastRenderedPlaying = false;
  let lastRenderedDuration = Number.NaN;
  let lastRenderedConnected = false;
  let runtimeAnchorTime = state.transport.currentTime;
  let runtimeAnchorTimestamp = performance.now();

  function isProjectReady(): boolean {
    const status = dbState.getSnapshot().status;
    return Boolean(sessionRef.current && (status === 'open' || status === 'saving'));
  }

  function loadFromDb(): void {
    const db = sessionRef.current?.data ?? null;

    state.tracks = [];
    state.clips = [];
    state.transport.currentTime = 0;
    state.transport.isPlaying = false;
    lastTimestamp = 0;

    if (!db) return;

    const parsed = parseFloat(db.variables.get('endTime') ?? '');
    state.transport.duration = isFinite(parsed) && parsed > 0 ? parsed : 30;

    const layerNums = [...new Set(db.bars.map((b) => b.layer))].sort((a, b) => a - b);

    state.tracks = layerNums.map((layer, index) =>
      createTrack({ id: `layer-${layer}`, label: `Layer ${layer}`, kind: 'generic', order: index, height: 18 }),
    );

    state.clips = db.bars.map((bar) =>
      createClip({
        id: `bar-${bar.id}`,
        trackId: `layer-${bar.layer}`,
        label: bar.type || `Bar ${bar.id}`,
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
    return Number(value.toFixed(2)).toString();
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

  return createContentRenderer((element) => {
    element.className = 'panel panel--timeline';

    const updatePlayhead = (): void => {
      const playhead = element.querySelector<HTMLElement>('.timeline-panel__playhead');
      if (!playhead) {
        return;
      }

      const playheadLeft = state.transport.currentTime * state.viewport.pixelsPerSecond * state.viewport.zoom;
      playhead.style.left = `${playheadLeft}px`;

      const label = playhead.querySelector('span');
      if (label) {
        label.textContent = `${formatTime(state.transport.currentTime)}s`;
      }
    };

    const render = (force = false): void => {
      const transportDisabled = !connection.isConnected();
      const connected = !transportDisabled;
      if (
        !force &&
        state.transport.isPlaying === lastRenderedPlaying &&
        state.transport.duration === lastRenderedDuration &&
        connected === lastRenderedConnected
      ) {
        updatePlayhead();
        return;
      }

      lastRenderedPlaying = state.transport.isPlaying;
      lastRenderedDuration = state.transport.duration;
      lastRenderedConnected = connected;

      const effectivePixelsPerSecond = state.viewport.pixelsPerSecond * state.viewport.zoom;
      const playheadLeft = state.transport.currentTime * effectivePixelsPerSecond;
      const timelineWidth = state.transport.duration * effectivePixelsPerSecond;
      const markerStep = getMarkerStep(effectivePixelsPerSecond);
      const markerCount = Math.floor(state.transport.duration / markerStep) + 1;
      const playTitle = state.transport.isPlaying ? 'Pause' : 'Play';

      element.innerHTML = `
        <div class="timeline-panel">
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

              <div class="timeline-panel__lanes" style="width:${timelineWidth}px">
                ${state.tracks
                  .map((track) => {
                    const trackClips = state.clips
                      .filter((clip) => clip.trackId === track.id)
                      .sort((a, b) => a.start - b.start);

                    return `
                      <div class="timeline-panel__lane" style="height:${track.height}px">
                        ${trackClips
                          .map((clip) => {
                            const left = clip.start * state.viewport.pixelsPerSecond * state.viewport.zoom;
                            const width = Math.max(
                              (clip.end - clip.start) * state.viewport.pixelsPerSecond * state.viewport.zoom,
                              36,
                            );
                            const isActive =
                              state.transport.currentTime >= clip.start &&
                              state.transport.currentTime <= clip.end;

                            return `
                              <article class="timeline-panel__clip ${isActive ? 'is-active' : ''}" style="left:${left}px;width:${width}px;border-color:${clip.color ?? CLIP_COLOR}">
                                <span class="timeline-panel__clip-label">${clip.label}</span>
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

      updatePlayhead();
    };

    const handleAction = (action: string): void => {
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

    element.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
      if (!target) {
        return;
      }

      handleAction(target.dataset.action ?? '');
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
  });
}
