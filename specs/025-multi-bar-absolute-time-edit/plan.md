# Implementation Plan: Absolute Time Editing For Multiple Bars

## Approach

Extract multi-bar time planning into a pure service. The service detects which aggregate editor fields changed, constructs absolute per-bar placements, validates every duration and same-layer interval against the complete proposed project state, and returns a discriminated result. Bar Editor applies snapshots only after a successful plan, preserving its existing Undo and Phoenix integration.

## Design Decisions

- Start and End fields remain initialized from the selected group's minimum start and maximum end.
- Equality with the initial aggregate value means that field was not edited.
- A changed field is an absolute assignment, not a delta.
- Adjacent intervals are allowed; strict temporal intersection is an overlap.
- Validation is pure and precedes every mutation.

## Files

- `src/services/multi-bar-time-edit.ts`: pure planner and validation.
- `src/panels/section-editor-panel.ts`: Bar Editor integration.
- `tests/unit/multi-bar-time-edit.test.ts`: behavior and atomic rejection coverage.

