# Data Model: Timeline Panel

## TimelineState

- `transport`: current playback information
- `viewport`: zoom and scroll state
- `snap`: snapping configuration
- `tracks`: ordered track list
- `clips`: time-bounded items placed on tracks
- `propertyChannels`: future keyframe lanes by property
- `selection`: current selected tracks, clips, channels, and keyframes
- `clipboard`: copied timeline items, if any

### Validation Rules

- Current time must stay within the available duration unless a loop range is
  applied.
- Zoom must remain between the configured minimum and maximum.
- Scroll positions must not produce negative viewport states.
- Selection lists should not contain duplicate ids.

## TimelineTransportState

- `currentTime`: current playback position
- `duration`: total duration of the sequence
- `isPlaying`: whether playback is active
- `playbackRate`: speed multiplier
- `loop`: optional active loop range

### Validation Rules

- `playbackRate` must be positive.
- `loop.start` must be less than or equal to `loop.end`.
- Current time should be clamped or wrapped according to active loop rules.

## TimelineViewportState

- `zoom`: active zoom factor
- `minZoom`: lower zoom bound
- `maxZoom`: upper zoom bound
- `scrollX`: horizontal scroll offset
- `scrollY`: vertical scroll offset
- `pixelsPerSecond`: base ruler scale

### Validation Rules

- `zoom` must remain within `[minZoom, maxZoom]`.
- `pixelsPerSecond` must be positive.

## TimelineTrack

- `id`: stable track identifier
- `label`: displayed track name
- `kind`: track category
- `enabled`: whether the track participates in active playback
- `locked`: whether editing is blocked
- `muted`: whether the track is silenced when audio is involved
- `order`: vertical ordering
- `height`: rendered lane height
- `collapsed`: whether the track content is hidden

### Relationships

- A track contains zero or more clips.
- A track can later own property channels indirectly through clip or project
  associations.

## TimelineClip

- `id`: stable clip identifier
- `trackId`: owning track
- `label`: displayed clip label
- `kind`: clip category
- `start`: start time
- `end`: end time
- `enabled`: whether the clip participates in active playback
- `locked`: whether the clip is editable
- `sourceId`: optional linked asset reference
- `color`: optional visual accent
- `metadata`: free-form clip metadata

### Validation Rules

- `start` must be less than or equal to `end`.
- A clip must reference an existing track.
- Disabled or locked clips remain visible but must be handled as non-editable in
  interaction logic where applicable.

## TimelinePropertyChannel

- `id`: stable channel identifier
- `ownerId`: owner reference
- `ownerKind`: owner classification
- `propertyPath`: property being animated
- `keyframes`: ordered keyframes
- `enabled`: whether the channel participates in evaluation

### Relationships

- A property channel contains zero or more keyframes.
- A channel belongs to a track, clip, or project scope depending on owner kind.

## TimelineKeyframe

- `id`: stable keyframe identifier
- `time`: keyframe time
- `value`: stored value
- `interpolation`: interpolation strategy
- `easing`: optional easing descriptor

### Validation Rules

- Keyframes in a channel must be ordered by time for evaluation.
- Keyframe interpolation must use a supported mode.

## TimelineSelection

- `trackIds`: selected tracks
- `clipIds`: selected clips
- `channelIds`: selected property channels
- `keyframeIds`: selected keyframes

### Validation Rules

- A selection list should not contain duplicates.
- Shift-click and box-select interactions must update selection without losing
  unrelated selected items unless the interaction explicitly clears them.

## TimelineClipboard

- `copiedAt`: time the clipboard capture was made
- `items`: copied timeline entries

### Relationships

- Clipboard entries may represent tracks, clips, channels, or keyframes.
- Pasting should preserve relative timing offsets where appropriate.

## TimelineAction

- `move`
- `trim`
- `resize-track`
- `split`
- `duplicate`
- `copy`
- `paste`
- `select`
- `scrub`
- `play`
- `pause`
- `toggle-play`
- `loop`
- `zoom`

### State Transitions

- Transport actions update current time and playback state.
- Editing actions update clip or track geometry and selection state.
- Zoom actions update viewport scale and may preserve the focal point.
