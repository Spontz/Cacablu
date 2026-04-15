# Timeline Package Contract

## Purpose

`packages/timeline` provides the reusable state and helper layer for the
timeline panel. It is consumed by the shell timeline panel and can also be used
by the `apps/studio` demo surface.

## Public Surface

The package must export the following types and helpers from
`packages/timeline/src/index.ts`:

- `TimelineState`
- `TimelineStateInit`
- `TimelineTransportState`
- `TimelineViewportState`
- `TimelineTrack`
- `TimelineClip`
- `TimelinePropertyChannel`
- `TimelineKeyframe`
- `TimelineSelection`
- `TimelineClipboard`
- `TimelineAction`
- `TimelineRange`
- `TimelineTrackKind`
- `TimelineClipKind`
- `TimelineInterpolation`
- `createTimelineState()`
- `createTrack()`
- `createClip()`
- `getActiveClips()`
- `clampTime()`
- `normalizeRange()`
- `rangeContainsTime()`
- `intersectsRange()`
- `sortTracks()`
- `getTrackById()`
- `getClipById()`

## Contract Rules

- `createTimelineState()` must return a valid empty state with transport,
  viewport, snap, tracks, clips, property channels, selection, and clipboard
  initialized.
- `createTrack()` must normalize optional fields and produce a valid track
  record.
- `createClip()` must normalize optional fields and produce a valid clip
  record.
- `getActiveClips()` must return only clips that are enabled, enabled by track
  state, and intersect the requested time.
- Timeline time values are expressed in seconds as numbers.
- Track and clip ids are opaque string identifiers.
- Property channels are stored now even if their visual editor is deferred.

## Timeline Actions

Consumers may dispatch `TimelineAction` objects with the following types:

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

The package does not require a specific reducer implementation, but action
shapes must remain stable enough for the panel, demo surface, and future tests
to share.

## Integration Notes

- The package is browser-first and does not depend on a backend.
- The shell panel may control a connected engine, but the package must remain
  usable in demo mode without one.
- Snapping, selection, transport, and zoom behavior are part of the package's
  model contract even if rendering lives in the consuming panel.
