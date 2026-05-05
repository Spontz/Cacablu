# Tasks: 3D Model Preview in Inspector

**Input**: Design documents from `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/inspector-3d-preview-contract.md, quickstart.md

**Validation**: Every story includes manual visual validation. Automated tests cover model classification and fallback decisions. Browser code must pass `npm test`, `npm run lint`, and `npm run build`.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared Three.js/model-preview foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks
- **[Story]**: Maps a task to a user story from `spec.md`
- Every task includes exact repository file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the rendering dependency and establish source/test files for model preview logic.

- [x] T001 Install the `three` runtime dependency and update `C:\Users\merlu\Documents\GitHub\Cacablu\package.json` and `C:\Users\merlu\Documents\GitHub\Cacablu\package-lock.json`
- [x] T002 [P] Create model classification helper skeleton in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-preview.ts`
- [x] T003 [P] Create model classification test skeleton in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`
- [x] T004 [P] Create Three.js viewer lifecycle module skeleton in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement format classification and the reusable viewer lifecycle required by every story.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Implement model descriptor classification for `.glb`, `.gltf`, `.obj`, `.fbx`, `.dae`, `.3ds`, `.md2`, `.md3`, `.lwo`, `.lws`, and `.blend` in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-preview.ts`
- [x] T006 [P] Add model descriptor tests for previewable formats in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`
- [x] T007 [P] Add model descriptor tests for recognized fallback formats and unknown non-model files in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`
- [x] T008 Add empty-bytes and unsupported metadata fallback classification in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-preview.ts`
- [x] T009 Implement base Three.js scene, camera, renderer, lights, resize handling, animation loop, and disposal in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T010 Implement model resource disposal helpers for geometries, materials, textures, object URLs, event listeners, and animation frames in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T011 Run `npm test` to verify foundational model classification tests

**Checkpoint**: Model classification and viewer lifecycle are available. User story implementation can begin.

---

## Phase 3: User Story 1 - Preview Selected 3D Model (Priority: P1) MVP

**Goal**: Selecting a previewable 3D model in Resources shows a model preview and file metadata in Inspector.

**Independent Validation**: Open a project containing a valid embedded `.glb`, select it in Resources, and confirm Inspector displays the model preview and selected file name within 2 seconds.

### Validation for User Story 1

- [x] T012 [P] [US1] Add tests for GLB/GLTF/OBJ/FBX/DAE descriptor-to-loader mapping in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`
- [x] T013 [US1] Run manual visual validation for selecting a valid `.glb` and seeing a 3D preview using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md`
- [x] T014 [US1] Run `npm test` after completing US1 implementation

### Implementation for User Story 1

- [x] T015 [US1] Add GLTFLoader support for `.glb` and `.gltf` model bytes in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T016 [US1] Add OBJLoader support for `.obj` model bytes in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T017 [US1] Add FBXLoader and ColladaLoader support for `.fbx` and `.dae` model bytes in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T018 [US1] Fit loaded model bounds to camera and center model root in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T019 [US1] Integrate model descriptor checks into Inspector render flow before generic non-preview fallback in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T020 [US1] Render model preview frame, selected file name, format, and size metadata in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T021 [US1] Add model preview canvas/frame styles in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US1 MVP works independently: selecting a valid embedded `.glb` displays a 3D preview in Inspector.

---

## Phase 4: User Story 2 - Inspect Model Shape Interactively (Priority: P2)

**Goal**: Users can inspect the visible model from more than one angle inside the Inspector panel.

**Independent Validation**: Select a supported model, drag in the preview frame, and confirm the model changes angle while staying inside the panel.

### Validation for User Story 2

- [x] T022 [US2] Run manual visual validation for pointer-drag rotation and panel resize behavior using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md`
- [x] T023 [US2] Run `npm run build` after completing US2 implementation

### Implementation for User Story 2

- [x] T024 [US2] Implement pointer drag rotation for the model root in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T025 [US2] Reset model view to a predictable default on each new model load in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T026 [US2] Keep renderer sizing synchronized with the Inspector preview container in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T027 [US2] Add cursor and interaction affordance styles for model preview in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US2 works independently: the selected model can be inspected from multiple angles.

---

## Phase 5: User Story 3 - Handle Non-Model Selection (Priority: P2)

**Goal**: Selecting folders, images, or non-model files clears stale 3D previews and preserves existing Inspector behavior.

**Independent Validation**: Select a model to show a preview, then select an image, folder, and non-model file; Inspector must clear the model preview every time.

### Validation for User Story 3

- [x] T028 [US3] Run manual visual validation for model-to-image, model-to-folder, and model-to-non-model selection transitions using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md`
- [x] T029 [US3] Run `npm test` after completing US3 implementation

### Implementation for User Story 3

- [x] T030 [US3] Dispose the active model viewer whenever Inspector renders image, folder, empty, unavailable, or generic file states in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T031 [US3] Preserve existing image preview behavior when an image is selected after a model in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T032 [US3] Clear model viewer state on DB close/opening transitions and renderer disposal in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T033 [US3] Verify Resources model icon classification remains consistent with preview descriptor extensions in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\resources-panel.ts`

**Checkpoint**: US3 works independently: stale 3D previews never remain after non-model selections.

---

## Phase 6: User Story 4 - Communicate Model Preview Problems (Priority: P3)

**Goal**: Invalid, empty, unsupported, externally incomplete, or too-complex model selections show clear fallback UI.

**Independent Validation**: Select fallback-first or invalid model-like files and confirm Inspector shows preview-unavailable instead of a blank/stale canvas.

### Validation for User Story 4

- [x] T034 [P] [US4] Add tests for empty bytes, fallback-first formats, and unsupported model-like metadata in `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`
- [x] T035 [US4] Run manual validation for `.blend` fallback and invalid `.glb` loading failure using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md`
- [x] T036 [US4] Run `npm test` after completing US4 implementation

### Implementation for User Story 4

- [x] T037 [US4] Render preview-unavailable states for recognized fallback formats in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts`
- [x] T038 [US4] Convert Three.js loader failures into user-facing fallback messages in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T039 [US4] Ensure failed model loads dispose partial renderer/model resources in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`
- [x] T040 [US4] Add fallback/loading styles for model preview states in `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`

**Checkpoint**: US4 works independently: invalid or unsupported model selections show clear fallback states.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full feature, dependency hygiene, static runtime constraints, and code quality.

- [x] T041 [P] Update `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md` with any implementation-specific validation notes discovered during testing
- [x] T042 Run `npm test` for the full repository
- [x] T043 Run `npm run lint` for the full repository
- [x] T044 Run `npm run build` to verify typecheck, Vite build, and static bundle generation
- [x] T045 Run final manual browser validation with a valid `.glb` and at least one fallback-first model-like file using `C:\Users\merlu\Documents\GitHub\Cacablu\specs\008-3d-preview-inspector\quickstart.md`
- [x] T046 Verify the final dependency set introduces only `three` for this feature by inspecting `C:\Users\merlu\Documents\GitHub\Cacablu\package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (P1)**: Depends on Foundational and delivers the MVP.
- **US2 (P2)**: Depends on US1 model rendering.
- **US3 (P2)**: Depends on US1 and should preserve image-preview behavior from prior work.
- **US4 (P3)**: Depends on US1 loader integration and foundational descriptors.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 - Preview Selected 3D Model**: MVP after Phase 2.
- **US2 - Inspect Model Shape Interactively**: Requires a visible model from US1.
- **US3 - Handle Non-Model Selection**: Requires model viewer lifecycle from US1 and must preserve existing image/folder states.
- **US4 - Communicate Model Preview Problems**: Requires model descriptor and loader failure pathways.

### Within Each User Story

- Write/update deterministic unit tests before implementation when practical.
- Implement helper/classification before Inspector integration.
- Implement viewer lifecycle before adding interactive controls.
- Run automated checks and manual validation before closing the story.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001.
- T006 and T007 can run in parallel with T005 if descriptor interface is agreed.
- T012 can run in parallel with T015-T017.
- T027 can run in parallel with T024-T026 after class names are agreed.
- T034 can run in parallel with T037-T040.
- T041 can run in parallel with T042-T044 during final polish.

---

## Parallel Example: User Story 1

```text
Task: "T012 [P] [US1] Add tests for GLB/GLTF/OBJ/FBX/DAE descriptor-to-loader mapping in C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts"
Task: "T015 [US1] Add GLTFLoader support for .glb and .gltf model bytes in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts"
Task: "T019 [US1] Integrate model descriptor checks into Inspector render flow before generic non-preview fallback in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts"
```

## Parallel Example: User Story 4

```text
Task: "T034 [P] [US4] Add tests for empty bytes, fallback-first formats, and unsupported model-like metadata in C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts"
Task: "T037 [US4] Render preview-unavailable states for recognized fallback formats in C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts"
Task: "T040 [US4] Add fallback/loading styles for model preview states in C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for `.glb` preview first.
3. Validate with a real embedded `.glb` project asset.
4. Run `npm test`.
5. Stop for demo or continue to interaction and fallback stories.

### Incremental Delivery

1. Foundation: Three.js dependency, model descriptor, viewer skeleton.
2. US1: model preview MVP.
3. US2: drag/resize interaction.
4. US3: stale-preview cleanup and image/folder transitions.
5. US4: robust fallback states.
6. Polish: full checks, manual validation, dependency review.

### Parallel Team Strategy

1. One developer owns model classification/tests in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-preview.ts` and `C:\Users\merlu\Documents\GitHub\Cacablu\tests\unit\model-preview.test.ts`.
2. One developer owns Three.js viewer lifecycle in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\model-viewer.ts`.
3. One developer owns Inspector integration and styles in `C:\Users\merlu\Documents\GitHub\Cacablu\src\panels\inspector-panel.ts` and `C:\Users\merlu\Documents\GitHub\Cacablu\src\styles\app.css`.

---

## Notes

- [P] tasks are parallelizable only when file ownership avoids conflicts.
- The MVP should validate `.glb` first because it is most likely to be self-contained.
- `.blend` and other fallback-first extensions should never leave a blank or stale canvas.
- No task introduces backend calls, local engine messages, or direct filesystem reads for model preview.
