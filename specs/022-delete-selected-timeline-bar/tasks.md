# Tasks: Delete Selected Timeline Bars

**Input**: Design documents from `/specs/022-delete-selected-timeline-bar/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/section-deletion.md

**Validation**: Automated tests cover keyboard intent, atomic persistence, Undo restoration, disconnected behavior, and connected Phoenix ordering. Typecheck, scoped lint, production build, and Phoenix Debug build provide compile validation.

## Phase 1: Shared Deletion Foundation

- [x] T001 [P] Add selected-bar resolution, shortcut recognition, and editable-target guards in `src/services/bar-deletion.ts`.
- [x] T002 [P] Define complete immutable deletion snapshots using existing `DbBar` fields.
- [x] T003 Add one-operation selected-bar deletion with stale-id filtering and deterministic id order.

## Phase 2: User Story 1 - Delete Selected Bars (Priority: P1)

**Goal**: `Delete` and `Backspace` remove selected existing bars without interfering with text editing.

**Independent Validation**: Unit tests exercise both keys, no selection, stale selection, multi-selection, modifier rejection, and all editable targets.

- [x] T004 [US1] Move selected-bar command ownership to global routing in `src/app/shell.ts`.
- [x] T005 [US1] Prevent browser defaults only after the application consumes deletion.
- [x] T006 [US1] Clear resource selection and dispatch one Timeline refresh after local commit.
- [x] T007 [US1] Remove duplicate bar deletion and Phoenix synchronization ownership from `src/panels/timeline-panel.ts`.
- [x] T008 [US1] Add keyboard, selection, and focus-guard coverage in `tests/unit/bar-deletion.test.ts`.

## Phase 3: User Story 2 - Undo Deletion (Priority: P1)

**Goal**: One Undo restores the complete single- or multi-bar deletion atomically.

**Independent Validation**: Delete configured bars, restore them, save/reopen, and verify every field and stable id; introduce an id conflict and verify no partial restoration.

- [x] T009 [US2] Add transactional `restoreTimelineBars` to `src/db/db-session.ts`.
- [x] T010 [US2] Push one Undo action with complete cloned snapshots and prior selected ids.
- [x] T011 [US2] Restore stable ids and every persisted field, refresh Timeline, and reselect restored bars.
- [x] T012 [US2] Preserve failed Undo in the shared Undo manager and report through the existing application error flow.
- [x] T013 [US2] Add persistence and atomic conflict coverage in `tests/unit/db-session.test.ts`.

## Phase 4: User Story 3 - Synchronize Phoenix (Priority: P2)

**Goal**: Connected Phoenix removes deleted sections and republishes undone bars in the correct order.

**Independent Validation**: Run connected service integration with both keys and prove `deleteMany` completes before `replaceOne`.

- [x] T014 [US3] Send all committed deletion ids through one existing Phoenix `deleteMany` request.
- [x] T015 [US3] Republish restored eligible bars through the existing single-section path.
- [x] T016 [US3] Skip all requests and disconnected-sync errors while Phoenix is disconnected.
- [x] T017 [US3] Preserve local state and report affected ids when connected synchronization fails.
- [x] T018 [US3] Sequence immediate Undo after any in-flight deletion synchronization.
- [x] T019 [US3] Add connected ordering, publication filtering, disconnected, and transport-failure coverage.
- [x] T020 [US3] Verify Phoenix's existing delete endpoint removes matching runtime sections and root `.spo` files only.

## Phase 5: Validation

- [x] T021 Run Cacablu typecheck successfully.
- [x] T022 Run scoped ESLint successfully for every changed file.
- [x] T023 Run the complete Cacablu test suite successfully: 173 tests.
- [x] T024 Build the Cacablu production bundle successfully.
- [x] T025 Build Phoenix Debug successfully and verify the editor health API.

## Dependencies & Execution Order

- Phase 1 precedes keyboard and Undo integration.
- User Story 1 establishes the committed deletion used by User Stories 2 and 3.
- User Story 2 can be implemented independently of a running Phoenix instance.
- User Story 3 depends on deletion snapshots and Undo lifecycle for ordering.
- Validation follows all desired stories.

## Parallel Opportunities

- Shortcut/focus tests and database transaction tests affect separate modules.
- Phoenix service tests can run independently of database persistence tests.
- Cacablu unit tests and Phoenix compilation can run in parallel.
