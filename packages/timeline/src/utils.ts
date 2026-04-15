import type {
  TimelineClip,
  TimelineClipKind,
  TimelineRange,
  TimelineState,
  TimelineStateInit,
  TimelineTime,
  TimelineTrack,
} from './model';

const DEFAULT_SNAP_TARGETS = [
  'grid',
  'playhead',
  'clip-start',
  'clip-end',
  'keyframe',
  'track-start',
  'track-end',
] as const;

export function clampTime(value: TimelineTime, min: TimelineTime, max: TimelineTime): TimelineTime {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRange(range: TimelineRange): TimelineRange {
  return range.start <= range.end
    ? range
    : {
        start: range.end,
        end: range.start,
      };
}

export function rangeContainsTime(range: TimelineRange, time: TimelineTime): boolean {
  const normalized = normalizeRange(range);
  return time >= normalized.start && time <= normalized.end;
}

export function intersectsRange(
  leftStart: TimelineTime,
  leftEnd: TimelineTime,
  rightStart: TimelineTime,
  rightEnd: TimelineTime,
): boolean {
  return leftStart <= rightEnd && leftEnd >= rightStart;
}

export function createTimelineState(init: TimelineStateInit = {}): TimelineState {
  return {
    transport: {
      currentTime: init.currentTime ?? 0,
      duration: init.duration ?? 60,
      isPlaying: false,
      playbackRate: 1,
      loop: init.loop ?? null,
    },
    viewport: {
      zoom: init.zoom ?? 1,
      minZoom: init.minZoom ?? 0.25,
      maxZoom: init.maxZoom ?? 8,
      scrollX: 0,
      scrollY: 0,
      pixelsPerSecond: init.pixelsPerSecond ?? 120,
    },
    snap: {
      enabled: init.snap?.enabled ?? true,
      tolerance: init.snap?.tolerance ?? 8,
      targets: init.snap?.targets ?? [...DEFAULT_SNAP_TARGETS],
    },
    tracks: [],
    clips: [],
    propertyChannels: [],
    selection: {
      trackIds: [],
      clipIds: [],
      channelIds: [],
      keyframeIds: [],
    },
    clipboard: null,
  };
}

export function createTrack(
  track: Pick<TimelineTrack, 'id' | 'label' | 'kind' | 'order'> &
    Partial<Pick<TimelineTrack, 'enabled' | 'locked' | 'muted' | 'height' | 'collapsed'>>,
): TimelineTrack {
  return {
    enabled: track.enabled ?? true,
    locked: track.locked ?? false,
    muted: track.muted ?? false,
    height: track.height ?? 56,
    collapsed: track.collapsed ?? false,
    ...track,
  };
}

export function createClip(
  clip: Pick<TimelineClip, 'id' | 'trackId' | 'label' | 'start' | 'end'> &
    Partial<Pick<TimelineClip, 'kind' | 'enabled' | 'locked' | 'sourceId' | 'color' | 'metadata'>>,
): TimelineClip {
  return {
    kind: clip.kind ?? 'media',
    enabled: clip.enabled ?? true,
    locked: clip.locked ?? false,
    sourceId: clip.sourceId ?? null,
    color: clip.color ?? null,
    metadata: clip.metadata ?? {},
    ...clip,
  };
}

export function clipIsActiveAtTime(clip: TimelineClip, time: TimelineTime): boolean {
  return clip.enabled && time >= clip.start && time <= clip.end;
}

export function getActiveClips(state: TimelineState, time: TimelineTime): TimelineClip[] {
  return state.clips.filter((clip) => {
    const track = state.tracks.find((candidate) => candidate.id === clip.trackId);

    if (!track || !track.enabled || track.muted || clip.locked) {
      return false;
    }

    return clipIsActiveAtTime(clip, time);
  });
}

export function sortTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return [...tracks].sort((left, right) => left.order - right.order);
}

export function getTrackById(tracks: TimelineTrack[], trackId: string): TimelineTrack | null {
  return tracks.find((track) => track.id === trackId) ?? null;
}

export function getClipById(clips: TimelineClip[], clipId: string): TimelineClip | null {
  return clips.find((clip) => clip.id === clipId) ?? null;
}

export function deriveClipKind(kind: TimelineClipKind): 'media' | 'event' | 'region' | 'gap' {
  return kind;
}
