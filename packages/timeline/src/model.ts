export type TimelineId = string;
export type TimelineTime = number;

export type TimelineTrackKind = 'video' | 'audio' | 'generic';
export type TimelineClipKind = 'media' | 'event' | 'region' | 'gap';
export type TimelineOwnerKind = 'track' | 'clip' | 'project';
export type TimelineInterpolation = 'hold' | 'linear' | 'bezier';

export interface TimelineRange {
  start: TimelineTime;
  end: TimelineTime;
}

export interface TimelineTransportState {
  currentTime: TimelineTime;
  duration: TimelineTime;
  isPlaying: boolean;
  playbackRate: number;
  loop: TimelineRange | null;
}

export interface TimelineViewportState {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  scrollX: number;
  scrollY: number;
  pixelsPerSecond: number;
}

export interface TimelineTrack {
  id: TimelineId;
  label: string;
  kind: TimelineTrackKind;
  enabled: boolean;
  locked: boolean;
  muted: boolean;
  order: number;
  height: number;
  collapsed: boolean;
}

export interface TimelineClip {
  id: TimelineId;
  trackId: TimelineId;
  label: string;
  kind: TimelineClipKind;
  start: TimelineTime;
  end: TimelineTime;
  enabled: boolean;
  locked: boolean;
  sourceId: string | null;
  color: string | null;
  metadata: Record<string, unknown>;
}

export interface TimelineKeyframe<TValue = unknown> {
  id: TimelineId;
  time: TimelineTime;
  value: TValue;
  interpolation: TimelineInterpolation;
  easing: string | null;
}

export interface TimelinePropertyChannel {
  id: TimelineId;
  ownerId: TimelineId;
  ownerKind: TimelineOwnerKind;
  propertyPath: string;
  keyframes: TimelineKeyframe[];
  enabled: boolean;
}

export interface TimelineSelection {
  trackIds: TimelineId[];
  clipIds: TimelineId[];
  channelIds: TimelineId[];
  keyframeIds: TimelineId[];
}

export interface TimelineClipboardEntry {
  kind: 'track' | 'clip' | 'channel' | 'keyframe';
  snapshot: TimelineTrack | TimelineClip | TimelinePropertyChannel | TimelineKeyframe;
}

export interface TimelineClipboard {
  copiedAt: TimelineTime;
  items: TimelineClipboardEntry[];
}

export interface TimelineSnapSettings {
  enabled: boolean;
  tolerance: number;
  targets: Array<
    'grid' |
    'playhead' |
    'clip-start' |
    'clip-end' |
    'keyframe' |
    'track-start' |
    'track-end'
  >;
}

export interface TimelineState {
  transport: TimelineTransportState;
  viewport: TimelineViewportState;
  snap: TimelineSnapSettings;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  propertyChannels: TimelinePropertyChannel[];
  selection: TimelineSelection;
  clipboard: TimelineClipboard | null;
}

export interface TimelineStateInit {
  duration?: TimelineTime;
  currentTime?: TimelineTime;
  loop?: TimelineRange | null;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pixelsPerSecond?: number;
  snap?: Partial<TimelineSnapSettings>;
}

export type TimelineAction =
  | {
      type: 'move';
      clipIds: TimelineId[];
      delta: TimelineTime;
      snap: boolean;
    }
  | {
      type: 'trim';
      clipId: TimelineId;
      edge: 'start' | 'end';
      time: TimelineTime;
      snap: boolean;
    }
  | {
      type: 'resize-track';
      trackId: TimelineId;
      height: number;
    }
  | {
      type: 'split';
      clipId: TimelineId;
      time: TimelineTime;
    }
  | {
      type: 'duplicate';
      clipIds: TimelineId[];
      offset: TimelineTime;
    }
  | {
      type: 'copy';
      selection: TimelineSelection;
    }
  | {
      type: 'paste';
      at: TimelineTime;
    }
  | {
      type: 'select';
      selection: TimelineSelection;
      additive: boolean;
      subtractive: boolean;
    }
  | {
      type: 'scrub';
      time: TimelineTime;
    }
  | {
      type: 'play';
    }
  | {
      type: 'pause';
    }
  | {
      type: 'toggle-play';
    }
  | {
      type: 'loop';
      range: TimelineRange | null;
    }
  | {
      type: 'zoom';
      zoom: number;
      anchorTime: TimelineTime | null;
    };
