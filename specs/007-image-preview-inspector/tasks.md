# Tasks: Image Preview in Inspector

**Input**: Design documents from `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/inspector-image-preview-contract.md, quickstart.md

**Validation**: Every story includes manual visual validation. Automated tests cover shared selection state and image classification logic. Browser code must pass `npm test`, `npm run lint`, and `npm run build` before completion.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks
- **[Story]**: Maps a task to a user story from `spec.md`
- All implementation tasks include exact repository file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing project structure and create the small helper surface needed by implementation.

- [x] T001 Review current Resources and Inspector wiring in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`, `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`, and `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\panel-registry.ts`
- [x] T002 [P] Create image preview helper module skeleton in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\image-preview.ts`
- [x] T003 [P] Create image preview helper test skeleton in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared selection contract and deterministic image classification needed by every user story.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Add `ResourceSelection` to `AppSnapshot` types in `C:\Users\merlu\Documents\GitHub\Cacablu\src\app\types.ts`
- [x] T005 Add `setResourceSelection` and `clearResourceSelection` to `AppState` in `C:\Users\merlu\Documents\GitHub\Cacablu\src\state\app-state.ts`
- [x] T006 [P] Add AppState unit tests for initial, file, folder, and cleared resource selection in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\app-state.test.ts`
- [x] T007 Implement image type classification for PNG, JPEG, GIF, WebP, BMP, and SVG in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\image-preview.ts`
- [x] T008 [P] Add image classification tests for file extension, stored type, stored format, and unknown files in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts`
- [x] T009 Reset resource selection when database state leaves the active project context in `C:\Users\merlu\Documents\GitHub\Cacablu\src\app\shell.ts`
- [x] T010 Run `npm test` to verify foundational state and image helper tests

**Checkpoint**: Resource selection and image classification are available. User story implementation can begin.

---

## Phase 3: User Story 1 - Preview Selected Image (Priority: P1) MVP

**Goal**: Selecting an image file in Resources updates Inspector with a preview and selected file name.

**Independent Validation**: Open a project containing an image file, select that file in Resources, and confirm Inspector displays that image and its file name within 1 second.

### Validation for User Story 1

- [x] T011 [P] [US1] Add unit tests for previewable image descriptor behavior with non-empty bytes in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts`
- [ ] T012 [US1] Run manual visual validation for selecting PNG or JPEG files and seeing the Inspector preview using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md`
- [x] T013 [US1] Run `npm test` after completing US1 implementation

### Implementation for User Story 1

- [x] T014 [US1] Add selectable file row metadata and file click handling in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`
- [x] T015 [US1] Publish file resource selections from Resources through AppState in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`
- [x] T016 [US1] Pass `dbState` and `sessionRef` into the Inspector panel factory in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\panel-registry.ts`
- [x] T017 [US1] Resolve selected image files from `sessionRef.current.data.files` in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T018 [US1] Render selected image file name and object URL backed `<img>` preview in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T019 [US1] Add Inspector image preview layout styles in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US1 MVP works independently: selecting a valid image in Resources shows a matching Inspector preview.

---

## Phase 4: User Story 2 - Handle Non-Image Selection (Priority: P1)

**Goal**: Selecting folders, non-image files, or no item clears stale previews and shows the current-selection state.

**Independent Validation**: Select an image to show a preview, then select a folder and a non-image file; Inspector must clear the previous preview every time.

### Validation for User Story 2

- [x] T020 [P] [US2] Add AppState or image helper tests covering `ResourceSelection.none`, folder selection, and non-image classification in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\app-state.test.ts`
- [ ] T021 [US2] Run manual visual validation for folder selection, non-image file selection, and empty selection using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md`
- [x] T022 [US2] Run `npm test` after completing US2 implementation

### Implementation for User Story 2

- [x] T023 [US2] Publish folder resource selections while preserving expand and collapse behavior in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`
- [x] T024 [US2] Add selected-row visual state for folders and files in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`
- [x] T025 [US2] Render Inspector empty, folder, and non-image file states in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T026 [US2] Revoke and clear any existing preview object URL when selection becomes folder, non-image, none, or no open DB in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T027 [US2] Add CSS for selected Resources rows and non-preview Inspector states in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US2 works independently: stale image previews never remain after a non-image, folder, or empty selection.

---

## Phase 5: User Story 3 - Preserve Project Isolation (Priority: P2)

**Goal**: Each project window keeps its own Resources selection and Inspector preview state.

**Independent Validation**: In the current single-shell architecture, verify selection state is owned by the shell instance and resets on DB changes; when multi-project windows are available, verify each window independently.

### Validation for User Story 3

- [x] T028 [P] [US3] Add unit tests proving separate AppState instances keep independent resource selections in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\app-state.test.ts`
- [ ] T029 [US3] Run manual validation that closing or replacing a project clears selection without retaining stale preview using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md`
- [x] T030 [US3] Run `npm test` after completing US3 validation

### Implementation for User Story 3

- [x] T031 [US3] Ensure Resources reads selected state only from the current `AppState` instance in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`
- [x] T032 [US3] Ensure Inspector resolves files only from the current `DbSessionRef` instance in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T033 [US3] Clear resource selection on project close, DB clear, or opening transition in `C:\Users\merlu\Documents\GitHub\Cacablu\src\app\shell.ts`

**Checkpoint**: US3 is satisfied by instance-scoped state and no cross-project/global preview data.

---

## Phase 6: User Story 4 - Communicate Preview Problems (Priority: P3)

**Goal**: Invalid, empty, unsupported, or too-large image selections show a clear fallback instead of a broken or stale preview.

**Independent Validation**: Select image-like files with empty, invalid, or unsupported content and confirm Inspector shows preview-unavailable fallback.

### Validation for User Story 4

- [x] T034 [P] [US4] Add image helper tests for empty bytes, unsupported image-like metadata, and fallback descriptors in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts`
- [ ] T035 [US4] Run manual visual validation for empty/invalid image content and large image sizing using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md`
- [x] T036 [US4] Run `npm test` after completing US4 implementation

### Implementation for User Story 4

- [x] T037 [US4] Return preview-unavailable descriptors for empty or unsupported image-like files in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\image-preview.ts`
- [x] T038 [US4] Handle `<img>` load errors by revoking the failed object URL and rendering fallback UI in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T039 [US4] Add preview-unavailable messaging and metadata display in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T040 [US4] Add CSS constraints for large images and fallback states in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US4 works independently: invalid image selections are clear and never show broken or stale previews.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full feature, static runtime constraints, and code quality.

- [x] T041 [P] Update implementation notes in `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md` if validation discovers necessary manual steps
- [x] T042 Run `npm run lint` for the full repository
- [x] T043 Run `npm run build` to verify typecheck, Vite build, and static bundle generation
- [ ] T044 Run final manual browser validation of all quickstart scenarios in `C:\Users\merlu\Documents\GitHub\Cacablu\specs\007-image-preview-inspector\quickstart.md`
- [x] T045 Verify no backend, network, local engine, or new runtime dependency was introduced by inspecting `C:\Users\merlu\Documents\GitHub\Cacablu\package.json` and changed source files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 and US2 (P1)**: Depend on Foundational. US1 is the MVP path; US2 can be implemented after the same foundation but touches overlapping panel files.
- **US3 (P2)**: Depends on Foundational and should be validated after US1/US2 behavior exists.
- **US4 (P3)**: Depends on US1 preview rendering and US2 clearing behavior.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 - Preview Selected Image**: Can start after Phase 2. Provides MVP.
- **US2 - Handle Non-Image Selection**: Can start after Phase 2. Best integrated after or alongside US1 because both edit Resources and Inspector.
- **US3 - Preserve Project Isolation**: Can start after Phase 2 for tests, but meaningful manual validation follows US1/US2.
- **US4 - Communicate Preview Problems**: Depends on US1 object URL rendering and US2 stale-preview clearing.

### Within Each User Story

- Write/update automated tests before implementation when the behavior is deterministic.
- Implement state/helper code before panel integration.
- Complete panel rendering before CSS polish.
- Run manual visual validation and relevant automated checks before closing each story.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T006 and T008 can run in parallel with implementation work in T004/T005/T007 once file ownership is clear.
- T011 can run in parallel with T014-T016 because it targets test coverage for helper behavior.
- T020 can run in parallel with T023-T024 if one person owns tests and another owns Resources UI changes.
- T028 can run in parallel with T031-T032.
- T034 can run in parallel with T038-T040 after T037 behavior is agreed.
- T041 can run in parallel with T042-T043 during final polish.

---

## Parallel Example: User Story 1

```text
Task: "T011 [P] [US1] Add unit tests for previewable image descriptor behavior with non-empty bytes in C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts"
Task: "T014 [US1] Add selectable file row metadata and file click handling in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts"
Task: "T016 [US1] Pass dbState and sessionRef into the Inspector panel factory in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\panel-registry.ts"
```

## Parallel Example: User Story 2

```text
Task: "T020 [P] [US2] Add AppState or image helper tests covering ResourceSelection.none, folder selection, and non-image classification in C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\app-state.test.ts"
Task: "T023 [US2] Publish folder resource selections while preserving expand and collapse behavior in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts"
Task: "T027 [US2] Add CSS for selected Resources rows and non-preview Inspector states in C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for US1.
3. Validate that selecting a valid image in Resources shows the correct Inspector preview.
4. Run `npm test`.
5. Stop for demo or continue to stale-preview handling in US2.

### Incremental Delivery

1. Foundation: selection state plus image classifier.
2. US1: image preview MVP.
3. US2: clear stale previews for folders, non-images, and empty selection.
4. US3: project-window isolation and reset validation.
5. US4: robust fallback states for invalid image content.
6. Final polish: lint, build, static/no-backend validation, manual quickstart pass.

### Parallel Team Strategy

1. One developer owns AppState and tests in `C:\Users\merlu\Documents\GitHub\Cacablu\src\state\app-state.ts` and `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\app-state.test.ts`.
2. One developer owns image helper/tests in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\image-preview.ts` and `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\image-preview.test.ts`.
3. One developer owns Resources/Inspector integration in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`, `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`, and `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`.

---

## Notes

- [P] tasks are parallelizable only when file ownership avoids conflicts.
- Every story remains read-only for project assets.
- No task introduces backend calls, local engine messages, direct filesystem reads, or new runtime dependencies.
- Manual browser validation remains required even when unit tests pass.
- Spec closed on 2026-05-05 after implementation, lint, tests, build, and dev-server smoke validation. Remaining unchecked tasks require a real project database containing images.
