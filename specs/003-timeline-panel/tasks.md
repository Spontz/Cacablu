# Tasks: Timeline Panel

**Input**: Design documents from `/specs/003-timeline-panel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Validation**: Every story includes manual visual validation. Static-file
execution, File System Access API compatibility, and `npm.cmd run typecheck`,
`npm.cmd run lint`, `npm.cmd run build` must be validated for the browser code
changed by the feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: `US1`, `US2`, `US3`, `US4`

## Phase 1: Setup

**Purpose**: Shared application setup and typography baseline

- [ ] T001 [P] Centralize the shared UI font baseline in `src/styles/theme.css` and consume it from `apps/studio/src/main.ts` and `apps/studio/src/app.css`
- [ ] T002 [P] Keep the reusable timeline package entry point aligned in `packages/timeline/src/index.ts` and `packages/timeline/package.json`
- [ ] T003 Confirm the timeline panel remains the default docked surface in `src/layout/dockview-workspace.ts` and `src/panels/timeline-panel.ts`

---

## Phase 2: Foundational

**Purpose**: Shared timeline state and helper primitives required by all stories

- [ ] T004 [P] Normalize the transport, viewport, snap, selection, and clipboard state shapes in `packages/timeline/src/model.ts`
- [ ] T005 [P] Add shared helpers for clamp, range normalization, overlap checks, and active clip lookup in `packages/timeline/src/utils.ts`
- [ ] T006 [P] Define stable timeline action shapes for move, trim, resize, split, duplicate, copy, paste, scrub, play, pause, loop, and zoom in `packages/timeline/src/model.ts`
- [ ] T007 Document the reusable timeline package contract in `specs/003-timeline-panel/contracts/timeline-package-contract.md`

**Checkpoint**: Shared timeline primitives are ready for panel work

---

## Phase 3: User Story 1 - See and Scrub the Timeline (Priority: P1)

**Goal**: Render a dense studio-style timeline with ruler scrubbing and a
visible playhead.

**Independent Validation**: Open the panel, verify the ruler and playhead are
visible, and click the ruler to move the playhead.

- [ ] T008 [P] [US1] Render the dense ruler, playhead, layered tracks, and compact clip lanes in `src/panels/timeline-panel.ts`
- [ ] T009 [P] [US1] Keep clip bars square, uniform in height, and single-line in `src/styles/app.css`
- [ ] T010 [US1] Wire ruler click scrubbing and playhead updates in `src/panels/timeline-panel.ts`
- [ ] T011 [US1] Validate ruler scrubbing, dense layout, and file:// build opening in `specs/003-timeline-panel/quickstart.md`

**Checkpoint**: Story 1 is independently visible and scrub-able

---

## Phase 4: User Story 2 - Control Playback from the Timeline (Priority: P2)

**Goal**: Provide the cassette-like transport bar beneath the timeline with
centered white icons.

**Independent Validation**: Use the transport controls to move to the start,
rewind, play/pause, advance, and jump to the end.

- [ ] T012 [P] [US2] Replace transport text with centered white SVG icons on raised blue buttons in `src/panels/timeline-panel.ts` and `src/styles/app.css`
- [ ] T013 [US2] Keep play, pause, rewind, forward, start, and end actions synchronized with timeline transport state in `src/panels/timeline-panel.ts`
- [ ] T014 [US2] Validate transport button behavior and the no-helper-copy requirement in `specs/003-timeline-panel/quickstart.md`

**Checkpoint**: Story 2 transport controls are independently usable

---

## Phase 5: User Story 3 - Navigate and Edit Timeline Content (Priority: P3)

**Goal**: Support zoom, selection, move, trim, resize, split, duplicate, copy,
paste, and snapping semantics.

**Independent Validation**: Use Shift + wheel for zoom, plain wheel for
scrolling, and verify the modeled edit actions remain available.

- [ ] T015 [P] [US3] Preserve Shift + wheel zoom and unmodified wheel scroll behavior in `src/panels/timeline-panel.ts`
- [ ] T016 [US3] Keep the selection, box-select, move, trim, resize, split, duplicate, copy, paste, and snap semantics represented in `packages/timeline/src/model.ts`
- [ ] T017 [US3] Validate compact timeline density and interaction affordances in `specs/003-timeline-panel/quickstart.md`

**Checkpoint**: Story 3 interaction model is independent of keyframes

---

## Phase 6: User Story 4 - Prepare for Property Keyframes (Priority: P4)

**Goal**: Keep keyframes modeled by property without redesigning the panel.

**Independent Validation**: Load property-channel state and confirm the model
retains it without breaking the clip layout.

- [ ] T018 [P] [US4] Keep property channels and keyframes modeled by property in `packages/timeline/src/model.ts` and `packages/timeline/src/utils.ts`
- [ ] T019 [US4] Confirm the data model can store future property keyframes without changing the panel layout in `specs/003-timeline-panel/data-model.md`
- [ ] T020 [US4] Validate property-channel readiness in `specs/003-timeline-panel/quickstart.md`

**Checkpoint**: Story 4 keyframe readiness is preserved in the data model

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish the feature with repo-wide validation and browser checks

- [ ] T021 [P] Re-run `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` after the timeline and typography changes
- [ ] T022 [P] Verify the generated `dist/index.html` opens from `file://` and the JetBrains font baseline is visible in both the shell and `apps/studio`
- [ ] T023 [P] Confirm the transport icons remain centered and readable across supported browser sizes in `src/styles/app.css`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup before Foundational
- Foundational before any user story
- User stories can proceed in priority order once Foundational is complete
- Polish depends on the desired user stories being complete

### User Story Dependencies

- US1 has no dependencies beyond Foundational
- US2 can start after Foundational and may reuse US1 rendering primitives
- US3 can start after Foundational and depends on the shared timeline model
- US4 can start after Foundational and depends on the shared data model

### Parallel Opportunities

- T001 and T002 can run in parallel
- T004, T005, and T006 can run in parallel
- T008 and T009 can run in parallel
- T012 can run in parallel with T013
- T015 can run in parallel with T016
- T018 can run in parallel with T019

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational
2. Deliver US1 so the dense timeline can be seen and scrubbed
3. Add US2 transport controls
4. Validate US3 zoom and edit semantics
5. Preserve US4 keyframe data model readiness

### Incremental Delivery

1. Build the reusable model first
2. Add the panel rendering and scrub behavior
3. Add the transport bar icon controls
4. Keep the interaction model stable for editing and keyframes

