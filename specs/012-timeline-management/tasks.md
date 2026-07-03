# Tasks: Timeline Management

**Input**: Design documents from `/specs/012-timeline-management/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Validation**: Manual visual validation requires a browser and optionally Phoenix in slave mode. Automated checks are `npm test`, `npm run typecheck`, and `npm run build`.

## Phase 1: Setup

- [ ] T001 Confirm existing timeline package capabilities in `packages/timeline/src/`
- [ ] T002 Confirm current `BARS` read/write paths in `src/db/`
- [ ] T003 Confirm current project section sync entry points in `src/services/project-section-sync.ts`

---

## Phase 2: Foundational

- [ ] T004 [P] Add project-session bar create/update/delete helper types
- [ ] T005 [P] Add timeline edit validation helpers for timing, duration, and layer
- [ ] T006 [P] Add tests for timeline edit validation
- [ ] T007 Implement SQLite `BARS` persistence helpers in `src/db/`
- [ ] T008 Add tests for bar create/update/delete persistence
- [x] T009 Extend app selection state to represent selected timeline bars
- [ ] T010 Add timeline sync event helper for Events panel entries

---

## Phase 3: User Story 1 - Load And Display Project Bars (Priority: P1)

**Goal**: Timeline opens empty without a project and renders real bars after project load.

**Independent Validation**: Open Timeline before and after loading a known project.

- [ ] T011 [US1] Ensure `src/panels/timeline-panel.ts` renders zero bars/layers without a project
- [ ] T012 [US1] Render project bars with stable ids, types, timing, and layers
- [ ] T013 [US1] Remove any remaining default placeholder layer/bar behavior
- [ ] T014 [US1] Add unit coverage for project bars to timeline state mapping
- [ ] T015 [US1] Manually validate empty and loaded timeline states

---

## Phase 4: User Story 2 - Select And Edit Timeline Bar Sections (Priority: P1)

**Goal**: Bar selection updates shared state and opens a right-side Section Editor.

**Independent Validation**: Select a bar, edit script/blend fields in Section Editor, apply, then clear selection.

- [x] T016 [US2] Implement bar click selection in `src/panels/timeline-panel.ts`
- [x] T017 [US2] Implement empty-space deselection
- [x] T018 [US2] Open/update Section Editor for selected timeline bars
- [x] T019 [US2] Register Section Editor in layout, panel registry, and Window menu
- [x] T020 [US2] Implement Bar Type selector, Script Template selector, and Save Template control in `src/panels/section-editor-panel.ts`
- [x] T021 [US2] Implement script code field, Blend Source selector, Blend Destination selector, Blend Equation selector, and Apply persistence
- [ ] T022 [US2] Clear Section Editor state after selected bar deletion
- [x] T023 [US2] Reopen/initialize Section Editor on single-click, including repeated clicks on the same selected bar
- [x] T024 [US2] Present Blend Equation values as Add, Subtract, and Reverse subtract while storing Phoenix-compatible values
- [x] T025 [US2] Add View menu toggle for displaying bar ids in timeline labels
- [ ] T026 [US2] Manually validate selection and Section Editor behavior

---

## Phase 5: User Story 3 - Edit Bars From Timeline (Priority: P1)

**Goal**: Create, move, resize, layer-change, and delete bars from Timeline.

**Independent Validation**: Edit a copied project, save, reopen, and confirm persisted bars.

- [ ] T027 [US3] Add a bar creation command or gesture
- [x] T028 [US3] Implement drag-to-move timing changes
- [x] T029 [US3] Implement drag-to-layer changes
- [ ] T030 [US3] Implement resize handles for start/end time changes
- [ ] T031 [US3] Implement selected bar deletion
- [x] T032 [US3] Persist committed move edits through the project session
- [x] T033 [US3] Reject or clamp invalid move edits before persistence, including same-layer overlap
- [x] T034 [US3] Add undo stack command for committed bar moves
- [ ] T035 [US3] Add tests for persisted create/move/resize/delete behavior
- [ ] T036 [US3] Manually validate save and reopen persistence

---

## Phase 6: User Story 4 - Sync Edited Bars To Phoenix (Priority: P2)

**Goal**: Debounced Phoenix section sync after committed local timeline edits.

**Independent Validation**: Edit bars with Phoenix connected and disconnected.

- [ ] T037 [US4] Add debounced timeline section sync scheduler
- [x] T038 [US4] Use single-section sync for committed bar move edits
- [ ] T039 [US4] Skip sync when Phoenix is disconnected and record an Event
- [x] T040 [US4] Record Phoenix section sync errors as Events with bar ids when known
- [x] T041 [US4] Mark timeline bars with known section sync errors in red
- [x] T042 [US4] Ensure sync modal progress counters advance only for real processed units
- [ ] T043 [US4] Prevent sync loops from runtime state updates
- [ ] T044 [US4] Add tests for sync scheduling and disconnected behavior
- [ ] T045 [US4] Manually validate connected and disconnected edit sync flows

---

## Phase 7: User Story 5 - Preserve Transport Usability (Priority: P3)

**Goal**: Timeline transport remains understandable with or without Phoenix.

**Independent Validation**: Open Timeline while Phoenix is disconnected and connected.

- [ ] T046 [US5] Keep transport visible when Phoenix is disconnected
- [ ] T047 [US5] Disable or no-op Phoenix-only transport controls while disconnected
- [ ] T048 [US5] Keep playhead driven by Phoenix runtime state when connected
- [x] T049 [US5] Add playhead glow trail while playing and fade it on pause
- [ ] T050 [US5] Manually validate transport states

---

## Phase 8: Polish & Validation

- [ ] T051 Run `npm test`
- [ ] T052 Run `npm run typecheck`
- [ ] T053 Run `npm run build`
- [ ] T054 Run quickstart validation from `quickstart.md`
- [ ] T055 Verify Events panel reports timeline sync failures clearly with compact text sizing
- [ ] T056 Verify labels and controls do not overlap at high/low zoom

## Dependencies & Execution Order

- Setup before Foundational
- Foundational before user stories
- US1 and US2 are required before US3
- US4 depends on committed edit flow from US3 and Section Editor Apply behavior from US2
- US5 can proceed after US1 but should be validated after US4

## Parallel Opportunities

- T004, T005, T006 can run in parallel
- UI selection work and Inspector rendering can be split after selection state exists
- Sync scheduler tests can be prepared while Timeline edit UI is implemented
