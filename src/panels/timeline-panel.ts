import type { IContentRenderer } from 'dockview-core';

import {
  createClip,
  createTimelineState,
  createTrack,
  normalizeRange,
} from '../../packages/timeline/src/index';
import { createContentRenderer } from './base-panel';

const CLIP_COLOR = '#5e86b8';

export function createTimelinePanel(): IContentRenderer {
  const state = createTimelineState({
    duration: 40,
    currentTime: 5,
    loop: { start: 4, end: 18 },
    pixelsPerSecond: 88,
    zoom: 1,
  });

  state.tracks = [
    createTrack({ id: 'layer-01', label: 'Layer 01', kind: 'generic', order: 0, height: 56 }),
    createTrack({ id: 'layer-02', label: 'Layer 02', kind: 'generic', order: 1, height: 52 }),
    createTrack({ id: 'layer-03', label: 'Layer 03', kind: 'generic', order: 2, height: 46 }),
  ];

  state.clips = [
    createClip({
      id: 'clip-01',
      trackId: 'layer-01',
      label: 'Block A',
      start: 0.5,
      end: 9.5,
    }),
    createClip({
      id: 'clip-02',
      trackId: 'layer-01',
      label: 'Block B',
      start: 10.25,
      end: 18,
    }),
    createClip({
      id: 'clip-03',
      trackId: 'layer-02',
      label: 'Region A',
      start: 1,
      end: 14,
    }),
    createClip({
      id: 'clip-04',
      trackId: 'layer-02',
      label: 'Region B',
      start: 14.5,
      end: 34,
    }),
    createClip({
      id: 'clip-05',
      trackId: 'layer-03',
      label: 'Event A',
      start: 2.75,
      end: 7.25,
      kind: 'event',
    }),
  ];

  let lastTimestamp = 0;

  function formatTime(value: number): string {
    return value.toFixed(2).replace(/\.00$/, '');
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

    const render = (): void => {
      const playheadLeft = state.transport.currentTime * state.viewport.pixelsPerSecond * state.viewport.zoom;
      const timelineWidth = state.transport.duration * state.viewport.pixelsPerSecond * state.viewport.zoom;

      element.innerHTML = `
        <div class="timeline-panel">
          <div class="timeline-panel__viewport">
            <div class="timeline-panel__ruler" style="width:${timelineWidth}px">
              ${Array.from({ length: 21 }, (_, index) => {
                const time = index * 2;
                const left = time * state.viewport.pixelsPerSecond * state.viewport.zoom;
                return `<span class="timeline-panel__marker" style="left:${left}px"><i>${time}s</i></span>`;
              }).join('')}
            </div>

            <div class="timeline-panel__grid" style="width:${timelineWidth}px">
              ${Array.from({ length: 21 }, (_, index) => {
                const left = index * 2 * state.viewport.pixelsPerSecond * state.viewport.zoom;
                return `<span class="timeline-panel__grid-line" style="left:${left}px"></span>`;
              }).join('')}
            </div>

            <div class="timeline-panel__playhead" style="left:${playheadLeft}px">
              <span>${formatTime(state.transport.currentTime)}s</span>
            </div>

            <div class="timeline-panel__tracks" style="width:${timelineWidth}px">
              ${state.tracks
                .map((track) => {
                  const trackClips = state.clips
                    .filter((clip) => clip.trackId === track.id)
                    .sort((left, right) => left.start - right.start);

                  return `
                    <div class="timeline-panel__track">
                      <div class="timeline-panel__track-meta">
                        <strong>${track.label}</strong>
                      </div>
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
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <footer class="timeline-panel__transport-bar">
            <button data-action="start" title="Go to beginning" aria-label="Go to beginning">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 5h2v14H6zM18 5L8 12l10 7V5z" />
              </svg>
            </button>
            <button data-action="rewind" title="Rewind" aria-label="Rewind">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19 5 9 12l10 7V5zM11 5 1 12l10 7V5z" />
              </svg>
            </button>
            <button data-action="play" class="timeline-panel__transport-main" title="${
              state.transport.isPlaying ? 'Pause' : 'Play'
            }" aria-label="${state.transport.isPlaying ? 'Pause' : 'Play'}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                ${state.transport.isPlaying
                  ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z" />'
                  : '<path d="M7 5v14l11-7z" />'}
              </svg>
            </button>
            <button data-action="forward" title="Forward" aria-label="Forward">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M13 5 23 12 13 19V5zM5 5 15 12 5 19V5z" />
              </svg>
            </button>
            <button data-action="end" title="Go to end" aria-label="Go to end">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M16 5h2v14h-2zM6 5v14l10-7z" />
              </svg>
            </button>
          </footer>
        </div>
      `;
    };

    const handleAction = (action: string): void => {
      if (action === 'play') {
        state.transport.isPlaying = !state.transport.isPlaying;
        lastTimestamp = 0;
        render();
        return;
      }

      if (action === 'start') {
        state.transport.currentTime = 0;
        state.transport.isPlaying = false;
        lastTimestamp = 0;
        render();
        return;
      }

      if (action === 'rewind') {
        state.transport.currentTime = Math.max(state.transport.currentTime - 1, 0);
        render();
        return;
      }

      if (action === 'forward') {
        state.transport.currentTime = Math.min(state.transport.currentTime + 1, state.transport.duration);
        render();
        return;
      }

      if (action === 'end') {
        state.transport.currentTime = state.transport.duration;
        state.transport.isPlaying = false;
        lastTimestamp = 0;
        render();
        return;
      }
    };

    const tick = (timestamp: number): void => {
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

        const direction = event.deltaY > 0 ? -1 : 1;
        const nextZoom = Math.min(Math.max(state.viewport.zoom + direction * 0.08, 0.5), 2.5);

        if (nextZoom === state.viewport.zoom) {
          return;
        }

        const before = (viewport.scrollLeft + event.clientX - viewport.getBoundingClientRect().left) /
          (state.viewport.pixelsPerSecond * state.viewport.zoom);

        state.viewport.zoom = nextZoom;
        render();

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
      render();
    });
  });
}
