import '../../../src/styles/theme.css';
import './app.css';

import {
  createClip,
  createTimelineState,
  createTrack,
  getActiveClips,
  normalizeRange,
} from '../../../packages/timeline/src';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Application root element "#app" was not found.');
}

const appRoot: HTMLDivElement = root;

const state = createTimelineState({
  duration: 32,
  currentTime: 6.25,
  loop: { start: 4, end: 14 },
  pixelsPerSecond: 96,
  zoom: 1,
});

state.tracks = [
  createTrack({ id: 'track-video', label: 'Video', kind: 'video', order: 0, height: 56 }),
  createTrack({ id: 'track-audio', label: 'Audio', kind: 'audio', order: 1, height: 48 }),
  createTrack({ id: 'track-graphics', label: 'Graphics', kind: 'generic', order: 2, height: 42 }),
  createTrack({ id: 'track-automation', label: 'Automation', kind: 'generic', order: 3, height: 38 }),
];

state.clips = [
  createClip({
    id: 'clip-intro',
    trackId: 'track-video',
    label: 'Intro A-roll',
    start: 0.5,
    end: 7.5,
    color: '#58d0ff',
  }),
  createClip({
    id: 'clip-broll',
    trackId: 'track-video',
    label: 'B-roll',
    start: 8,
    end: 15.5,
    color: '#7cdb91',
  }),
  createClip({
    id: 'clip-voice',
    trackId: 'track-audio',
    label: 'Voiceover',
    start: 1.25,
    end: 13.75,
    color: '#f4c56a',
  }),
  createClip({
    id: 'clip-music',
    trackId: 'track-audio',
    label: 'Music bed',
    start: 14,
    end: 28,
    color: '#d59bff',
  }),
  createClip({
    id: 'clip-title',
    trackId: 'track-graphics',
    label: 'Title card',
    start: 2.5,
    end: 6.5,
    color: '#ff7d8c',
    kind: 'event',
  }),
  createClip({
    id: 'clip-lower-third',
    trackId: 'track-graphics',
    label: 'Lower third',
    start: 9.5,
    end: 12.5,
    color: '#8fd6ff',
    kind: 'region',
  }),
  createClip({
    id: 'clip-fade-in',
    trackId: 'track-automation',
    label: 'Opacity keyframes',
    start: 0,
    end: 4,
    color: '#97a6ff',
    kind: 'event',
  }),
];

const timelineViewport = {
  duration: state.transport.duration,
  zoom: state.viewport.zoom,
  pixelsPerSecond: state.viewport.pixelsPerSecond,
};

const timelineWidth = timelineViewport.duration * timelineViewport.pixelsPerSecond * timelineViewport.zoom;
const formatTime = (value: number): string => value.toFixed(2).replace(/\.00$/, '');
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
let lastTimestamp = 0;

function normalizeTime(time: number): number {
  const range = state.transport.loop ? normalizeRange(state.transport.loop) : null;

  if (!range) {
    return clamp(time, 0, state.transport.duration);
  }

  const span = range.end - range.start;

  if (span <= 0) {
    return range.start;
  }

  const relative = (time - range.start) % span;
  const normalized = relative < 0 ? relative + span : relative;

  return range.start + normalized;
}

function render(): void {
  const previousScrollLeft = appRoot.querySelector<HTMLElement>('.timeline-body')?.scrollLeft ?? 0;
  const previousScrollTop = appRoot.querySelector<HTMLElement>('.timeline-body')?.scrollTop ?? 0;
  const activeClips = getActiveClips(state, state.transport.currentTime);
  const playheadLeft = state.transport.currentTime * timelineViewport.pixelsPerSecond * timelineViewport.zoom;
  const loop = state.transport.loop ? normalizeRange(state.transport.loop) : null;

  appRoot.innerHTML = `
    <div class="studio-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Cacablu Studio</p>
          <h1>Timeline workspace</h1>
        </div>
        <div class="transport">
          <button data-action="play">${state.transport.isPlaying ? 'Pause' : 'Play'}</button>
          <button data-action="loop" class="${loop ? 'is-active' : ''}">Loop</button>
          <label class="field">
            <span>Zoom</span>
            <input data-action="zoom" type="range" min="0.5" max="2.5" step="0.05" value="${state.viewport.zoom}" />
          </label>
          <label class="field time">
            <span>Time</span>
            <input data-action="scrub" type="range" min="0" max="${state.transport.duration}" step="0.01" value="${state.transport.currentTime}" />
          </label>
        </div>
      </header>

      <section class="status-grid">
        <article class="status-card">
          <span>Current time</span>
          <strong>${formatTime(state.transport.currentTime)}s</strong>
        </article>
        <article class="status-card">
          <span>Loop</span>
          <strong>${loop ? `${formatTime(loop.start)}s - ${formatTime(loop.end)}s` : 'Off'}</strong>
        </article>
        <article class="status-card">
          <span>Active clips</span>
          <strong>${activeClips.length}</strong>
        </article>
        <article class="status-card">
          <span>Zoom</span>
          <strong>${state.viewport.zoom.toFixed(2)}x</strong>
        </article>
      </section>

      <main class="timeline-frame">
        <div class="timeline-toolbar">
          <div class="timeline-labels">
            <span>Track</span>
            <span>Mute</span>
            <span>Lock</span>
          </div>
          <div class="timeline-ruler">
            ${Array.from({ length: 17 }, (_, index) => {
              const marker = index * 2;
              return `<span class="ruler-mark" style="left:${marker * timelineViewport.pixelsPerSecond * timelineViewport.zoom}px"><i>${marker}s</i></span>`;
            }).join('')}
          </div>
        </div>

        <div class="timeline-body" style="--timeline-width:${timelineWidth}px">
          <div class="timeline-grid">
            ${Array.from({ length: Math.ceil(timelineViewport.duration / 2) + 1 }, (_, index) => {
              const left = index * 2 * timelineViewport.pixelsPerSecond * timelineViewport.zoom;
              return `<span class="grid-line" style="left:${left}px"></span>`;
            }).join('')}
          </div>

          <div class="playhead" style="left:${playheadLeft}px">
            <span>${formatTime(state.transport.currentTime)}s</span>
          </div>

          <div class="track-stack">
            ${state.tracks
              .map((track) => {
                const trackClips = state.clips
                  .filter((clip) => clip.trackId === track.id)
                  .sort((left, right) => left.start - right.start);

                return `
                  <section class="track-row ${track.enabled ? '' : 'is-disabled'} ${track.collapsed ? 'is-collapsed' : ''}" data-track="${track.id}">
                    <div class="track-meta">
                      <strong>${track.label}</strong>
                      <span>${track.kind}</span>
                    </div>
                    <div class="track-status">
                      <span class="chip ${track.enabled ? 'on' : 'off'}">${track.enabled ? 'On' : 'Off'}</span>
                      <span class="chip ${track.locked ? 'off' : 'on'}">${track.locked ? 'Locked' : 'Free'}</span>
                    </div>
                    <div class="track-lane" style="height:${track.height}px">
                      ${trackClips
                        .map((clip) => {
                          const left = clip.start * timelineViewport.pixelsPerSecond * timelineViewport.zoom;
                          const width = Math.max((clip.end - clip.start) * timelineViewport.pixelsPerSecond * timelineViewport.zoom, 32);
                          const isActive = state.transport.currentTime >= clip.start && state.transport.currentTime <= clip.end;

                          return `
                            <article class="clip ${isActive ? 'is-active' : ''}" style="left:${left}px;width:${width}px;border-color:${clip.color ?? '#4e596d'}">
                              <span class="clip-label">${clip.label}</span>
                              <span class="clip-time">${formatTime(clip.start)} - ${formatTime(clip.end)}</span>
                            </article>
                          `;
                        })
                        .join('')}
                    </div>
                  </section>
                `;
              })
              .join('')}
          </div>
        </div>
      </main>
    </div>
  `;

  const timelineBody = appRoot.querySelector<HTMLElement>('.timeline-body');

  if (timelineBody) {
    timelineBody.scrollLeft = previousScrollLeft;
    timelineBody.scrollTop = previousScrollTop;
  }

}

function tick(timestamp: number): void {
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
}

render();
requestAnimationFrame(tick);

appRoot.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');

  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'play') {
    state.transport.isPlaying = !state.transport.isPlaying;
    lastTimestamp = 0;
    render();
    return;
  }

  if (action === 'loop') {
    state.transport.loop = state.transport.loop
      ? null
      : {
          start: 4,
          end: 14,
        };

    render();
  }
});

appRoot.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | null;

  if (!target || !target.dataset.action) {
    return;
  }

  if (target.dataset.action === 'zoom') {
    state.viewport.zoom = Number(target.value);
    render();
    return;
  }

  if (target.dataset.action === 'scrub') {
    state.transport.currentTime = Number(target.value);
    render();
  }
});
