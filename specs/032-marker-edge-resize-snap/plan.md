# Implementation Plan: Snap Bar Edges To Timeline Markers

**Branch**: `032-marker-edge-resize-snap` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

## Summary

Add deterministic 10 CSS-pixel marker snapping to start/end bar resize gestures while `Shift` is held. Keep marker selection in a pure service, extend resize state to cover a single bar or the current multi-selection, recompute on both pointer and modifier-key events, preview the full atomic proposal, and commit one undoable placement transaction.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022  
**Dependencies**: Existing Timeline pointer interaction, `DbSessionRef`, shared selection, markers, UndoManager, and deferred Phoenix section sync  
**Storage**: Existing in-memory `ProjectDatabase`; committed bar times persist through `DbSession`  
**Testing**: Vitest for snap resolution and resize proposals; existing Timeline tests; focused browser validation  
**Constraints**: No marker mutation, no persistence during preview, constant screen-space threshold, no regression to Shift-click or Shift body-drag behavior

## Design

1. Add a pure snap resolver that filters enabled finite in-bounds markers, applies the 10 CSS-pixel threshold, and orders candidates by distance, time, and id.
2. Represent resize state as a resize set containing complete original placement snapshots, the pointer-derived endpoint, modifier state, current proposals, and optional snap target.
3. When a resize begins on a bar already in a multi-selection, include every selected existing bar; otherwise resize only the grabbed bar.
4. Recompute the same preview function on pointer movement, `Shift` keydown, and `Shift` keyup so modifier changes work without pointer movement.
5. Assign a snapped start or end to every affected bar while preserving each opposite endpoint, then validate duration, bounds, and all same-layer overlaps before preview/commit.
6. Render target-marker/guide and affected-edge classes as non-color-only feedback.
7. Commit all changed placements together, register one Undo transaction, preserve selection, and schedule existing per-bar Phoenix synchronization after commit.

## Project Structure

```text
specs/032-marker-edge-resize-snap/
├── spec.md
├── plan.md
└── tasks.md

src/services/timeline-marker-snap.ts
src/panels/timeline-panel.ts
src/styles/app.css
tests/unit/timeline-marker-snap.test.ts
```

## Constitution Check

- Browser-only deployment and the existing project database contract are preserved.
- Marker authority remains in project data; snapping never mutates markers.
- Pure deterministic logic receives focused unit coverage.
- Pointer previews remain in memory and persistence occurs only on pointer release.
- Existing Undo and Phoenix synchronization boundaries are reused.

