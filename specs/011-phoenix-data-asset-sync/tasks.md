# Tasks: Phoenix Data Asset Sync

**Input**: Design documents from `/specs/011-phoenix-data-asset-sync/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Validation**: Manual validation requires a Phoenix build with the native editor HTTP/WebSocket API running in slave mode. Project checks are `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Phase 1: Setup

- [x] T001 Confirm the loaded project/session state source in `src/state/app-state.ts` or the current project session module
- [x] T002 Confirm where project `data` folder handles are stored or requested in the existing shell/resource workflow
- [x] T003 Confirm the existing Phoenix connection module can be reused without coupling asset sync to timeline time sync

---

## Phase 2: Foundational

- [x] T004 [P] Define asset manifest, asset discrepancy, asset operation, and sync-state TypeScript types
- [x] T005 [P] Implement asset path normalization and validation helpers for `pool` and `resources`
- [x] T006 [P] Add unit tests for valid paths, `config` rejection, absolute path rejection, traversal rejection, and backslash normalization
- [x] T007 [P] Implement local manifest scanning for browser directory handles under `pool` and `resources`
- [x] T008 [P] Implement manifest comparison that classifies missing-local, missing-phoenix, changed, and type-mismatch discrepancies
- [x] T009 [P] Add unit tests for manifest comparison behavior
- [x] T010 Implement Phoenix asset API client helpers for manifest fetch and file/directory operations
- [x] T011 Implement Phoenix asset WebSocket event parsing for `asset.changed` and structured errors
- [ ] T011a [P] Define section manifest, project bar snapshot, section discrepancy, and section replacement TypeScript types
- [ ] T011b [P] Implement project bar serialization to Phoenix-compatible canonical section payloads
- [ ] T011c Implement Phoenix section API client helpers for manifest fetch and full replacement
- [ ] T011d Implement Phoenix section WebSocket event parsing for `section.changed` and structured section errors

---

## Phase 3: User Story 1 - Require Project Context Before Sync (Priority: P1)

**Goal**: Block all Phoenix asset comparison and transfer when no Cacablu project is loaded.

**Independent Validation**: Open Cacablu with no project and verify no Phoenix manifest or mutation request is sent.

- [x] T012 [US1] Gate asset sync state behind loaded project detection
- [x] T013 [US1] Show blocked-no-project state in the relevant asset/resource UI
- [x] T014 [US1] Prevent local folder selection or asset sync actions from sending Phoenix requests when no project is loaded
- [x] T015 [US1] Clear asset sync state and pending operations when the project closes or is replaced

---

## Phase 4: User Story 2 - Compare Project Data With Phoenix Data (Priority: P1)

**Goal**: Compare the loaded project's `data/pool` and `data/resources` against Phoenix's active engine `data` folder.

**Independent Validation**: Use matching and intentionally different folders and confirm sync/discrepancy reporting.

- [x] T016 [US2] Request or reuse browser access to the loaded project's `data` folder
- [x] T017 [US2] Validate that `pool` and `resources` exist under the project `data` folder
- [x] T018 [US2] Build the local project asset manifest from `pool` and `resources`
- [x] T019 [US2] Fetch Phoenix's asset manifest when Phoenix is connected
- [x] T020 [US2] Compare local and Phoenix manifests and store discrepancy results
- [x] T021 [US2] Render synchronized, discrepant, disconnected, scanning, comparing, and error states
- [x] T022 [US2] Render discrepancy rows with relative path and discrepancy type
- [x] T022a [US2] Add an Assets/Resources segmented switcher where Assets displays `pool` and Resources displays `data/resources`
- [x] T022b [US2] Render pool file enabled state from the project database and exclude disabled pool files from expected Phoenix file entries
- [x] T022c [US2] Remove Phoenix destination `data` folder selection UI from the Resources/Assets panel
- [x] T022d [US2] On project open, compare enabled database pool files against Phoenix pool by path and size
- [x] T022e [US2] Skip initial copying when Phoenix pool exactly matches the enabled project pool manifest
- [x] T022f [US2] Delete and recreate Phoenix pool before initial copy when manifests differ
- [x] T022g [US2] Show initial copy progress in a blocking modal that prevents using Cacablu until completion
- [x] T022h [US2] Add Cancel for initial copy and leave Cacablu without a loaded project/pool when cancelled

---

## Phase 4A: User Story 5 - Publish Project Bars As Phoenix Sections (Priority: P1)

**Goal**: Compare serialized project bars with Phoenix runtime sections and replace Phoenix sections when they differ.

**Independent Validation**: Open a project with matching and intentionally different Phoenix sections; verify exact matches skip replacement and mismatches replace all sections.

- [ ] T022i [US5] Build the expected project bar snapshot from all database `bars` after the pool sync completes or is skipped
- [ ] T022j [US5] Fetch Phoenix's section manifest when Phoenix is connected
- [ ] T022k [US5] Compare project bar snapshot against Phoenix sections by id, type, start/end, enabled state, layer, blend metadata, and script content/hash
- [ ] T022l [US5] Skip section replacement when the project bar snapshot exactly matches Phoenix sections
- [ ] T022m [US5] Send a full section replacement request containing all project bars when any section differs
- [ ] T022n [US5] Include section sync in the blocking project-open modal and Cancel behavior
- [ ] T022o [US5] Leave Cacablu without the opened project loaded if section sync is cancelled or fails
- [ ] T022p [US5] Add tests for bar serialization, exact-match comparison, mismatch detection, and replacement request formatting
- [ ] T022q [US5] Parse Phoenix section replacement responses/events that include persisted and deleted `<id>.spo` filenames

---

## Phase 5: User Story 3 - Mirror Project Asset Changes Into Phoenix (Priority: P2)

**Goal**: Send allowed local asset file/directory changes to Phoenix as explicit operations.

**Independent Validation**: Create, replace, delete, and create/delete directories under `pool` and `resources` and confirm Phoenix applies them.

- [x] T023 [US3] Send create/replace file operations for loaded-project files under `pool`
- [x] T024 [US3] Send create/replace file operations for loaded-project files under `resources`
- [x] T025 [US3] Send delete file operations for allowed loaded-project asset paths
- [x] T025a [US3] Toggle pool file enabled state from Assets and write/delete the corresponding Phoenix file when connected
- [x] T025b [US3] Support dragging files into pool folders and mirror created files to Phoenix when enabled
- [x] T025c [US3] Support moving pool files between folders and mirror the move to Phoenix
- [x] T025d [US3] Reconcile atomic multi-item and folder drag moves, including every enabled descendant destination and obsolete source path, only after local commit
- [x] T026 [US3] Send create directory operations for allowed loaded-project asset paths
- [x] T027 [US3] Send delete directory operations for allowed loaded-project asset paths with explicit recursive behavior when needed
- [x] T028 [US3] Correlate Phoenix operation responses/events by request id where available
- [x] T029 [US3] Refresh or update discrepancy state after Phoenix confirms or rejects an operation
- [x] T030 [US3] Show non-blocking operation errors without breaking the resource UI

---

## Phase 6: User Story 4 - Keep Sync Safely Scoped (Priority: P2)

**Goal**: Ensure Cacablu never sends out-of-scope asset mutations to Phoenix.

**Independent Validation**: Attempt `config`, absolute, and traversal paths and confirm no Phoenix mutation request is sent.

- [x] T031 [US4] Block `config` paths before operation creation
- [x] T032 [US4] Block absolute and traversal paths before operation creation
- [x] T033 [US4] Normalize all outgoing paths to forward-slash relative form
- [x] T034 [US4] Add user-facing warning or blocked state for out-of-scope transfer attempts
- [x] T035 [US4] Add tests proving blocked paths do not call the Phoenix asset client
- [x] T035a [US4] Surface browser/Phoenix network failures with actionable messages and keep abort cancellation distinct from real failures

---

## Phase 7: Polish & Validation

- [x] T036 Run `npm test`
- [x] T037 Run `npm run typecheck`
- [x] T038 Run `npm run lint`
- [x] T039 Run `npm run build`
- [ ] T040 Manually validate no-project blocked behavior using `quickstart.md`
- [x] T041 Manually validate exact-match and non-matching initial pool sync behavior against Phoenix with the desktop SQLite project
- [x] T042 Manually validate create, replace, delete file, create directory, and delete directory operations against Phoenix
- [ ] T043 Manually validate `config`, absolute path, and traversal path blocking
- [ ] T044 Manually validate exact-match project bars skip Phoenix section replacement
- [ ] T045 Manually validate changed, missing, or extra Phoenix sections trigger full section replacement
- [ ] T046 Manually validate invalid section replacement errors leave Cacablu usable and the project unopened
- [ ] T047 Manually validate Phoenix writes `<id>.spo` files directly under its active `data` folder after section replacement
- [ ] T048 Manually validate Phoenix deletes root `<id>.spo` files for sections removed by replacement

---

## Dependencies & Execution Order

- Setup before Foundational
- Foundational before all user stories
- US1 is required before US2 and US3
- US2 can be implemented before mutation sending
- US5 depends on US2's project-open sync flow and should run after the initial pool sync completes or is skipped
- US4 safety checks should be implemented before enabling US3 transfer actions
- Polish depends on implemented stories

## Parallel Opportunities

- T004, T005, T007, T008, and T010 can proceed in parallel after setup.
- T011a and T011b can proceed in parallel with Phoenix section API contract work.
- T006 and T009 can be written in parallel with helper implementation.
- UI state rendering and contract client work can proceed in parallel once shared types exist.

## Implementation Strategy

1. Define types, path helpers, manifest scan, and comparison first.
2. Add Phoenix asset API client and event parsing.
3. Gate all sync behavior behind loaded project state.
4. Add manifest comparison UI.
5. Add project bar serialization and section exact-match/replacement sync.
6. Wire allowed asset operations.
7. Add safety tests and manual Phoenix validation.
