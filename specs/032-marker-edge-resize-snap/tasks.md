# Tasks: Snap Bar Edges To Timeline Markers

## Phase 1: Specification And Snap Model

- [x] T001 Define single-bar, multi-bar, modifier timing, deterministic target, validation, feedback, and regression behavior.
- [x] T002 Document pure snap resolution, resize-set state, atomic commit, and Undo design.
- [x] T003 Implement the pure enabled-marker snap resolver with a 10 CSS-pixel threshold.
- [x] T004 Add unit tests for threshold, zoom scaling, disabled/invalid markers, and deterministic ties.

## Phase 2: Timeline Integration

- [x] T005 Extend edge resize state to capture one or all selected bars and the last pointer position.
- [x] T006 Build and validate common start/end proposals while preserving opposite endpoints.
- [x] T007 Recompute resize preview on pointermove, Shift keydown, and Shift keyup.
- [x] T008 Add atomic multi-bar commit and one-action Undo with deferred per-bar Phoenix sync.
- [x] T009 Add target marker, guide, and affected-edge snap feedback.
- [x] T010 Preserve free resize, Shift-click selection, and Shift body-drag behavior.

## Phase 3: Validation

- [x] T011 Run focused snap and Timeline unit tests.
- [x] T012 Run TypeScript typecheck and changed-file lint.
- [x] T013 Run the complete unit suite.
- [x] T014 Run the production build.
- [x] T015 Validate single/multiple start/end snap, stationary Shift toggling, feedback, invalid proposals, and Undo in a real browser.
