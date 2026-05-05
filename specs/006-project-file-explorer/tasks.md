---
description: "Task list for 006-project-file-explorer"
---

# Tasks: Project File Explorer

**Input**: Design documents from `specs/006-project-file-explorer/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Validation**: Every story requires manual visual validation. Compile/lint checks required before closing each story. No backend or server dependency — validate static execution path explicitly.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)

---

## Phase 1: Setup

**Purpose**: No new project structure needed. Only two existing files change.

- [ ] T001 Confirm `src/panels/resources-panel.ts` and `src/panels/panel-registry.ts` compile cleanly before any changes (`npm run typecheck` or equivalent)

---

## Phase 2: Foundational — Wire Resources Panel Dependencies

**Purpose**: Update `panel-registry.ts` so the resources panel creator receives `dbState` and `sessionRef`. This unblocks all user story implementation.

**CRITICAL**: Must complete before any tree implementation work.

- [ ] T002 In `src/panels/panel-registry.ts`, update the `case 'resources':` branch to call the resources panel creator with `(dbState, sessionRef)` — matching the pattern of the `case 'db-explorer':` branch
- [ ] T003 Update the `createResourcesPanel` function signature in `src/panels/resources-panel.ts` to accept `(dbState: DbState, sessionRef: DbSessionRef)` — add imports, keep the existing placeholder rendering for now
- [ ] T004 Run `npm run typecheck` and confirm no type errors from the signature change

**Checkpoint**: Panel registry correctly injects dependencies. Resources panel compiles with new signature.

---

## Phase 3: User Story 1 — Browse the Project File Tree (Priority: P1)

**Goal**: The Resources panel shows the full folder/file hierarchy of the loaded project, with expandable and collapsible folders.

**Independent Validation**: Open a `.sqlite` project with folders and files → confirm the tree appears in the Resources panel with expand/collapse working correctly.

### Implementation for User Story 1

- [ ] T005 [US1] In `src/panels/resources-panel.ts`, define the `TreeNode` type (kind, id, name, type, children) as documented in `specs/006-project-file-explorer/data-model.md`
- [ ] T006 [US1] In `src/panels/resources-panel.ts`, implement `buildTree(folders: DbFolder[], files: DbFile[]): TreeNode[]` — builds root-level array using `parent` field; broken parent references go to root
- [ ] T007 [US1] In `src/panels/resources-panel.ts`, add `expandedIds = new Set<number>()` panel-local state; reset it on every DB open
- [ ] T008 [US1] In `src/panels/resources-panel.ts`, implement `renderTree(root: TreeNode[], container: HTMLElement)` — renders `<ul>/<li>` structure; folder nodes toggle `expandedIds` on click and re-render their subtree
- [ ] T009 [US1] In `src/panels/resources-panel.ts`, implement the `dbState` subscription in `init()`: call `buildTree` + `renderTree` when `status === 'open'`; reset + show placeholder when `status` is `'none'` or `'error'`; store the unsubscribe function
- [ ] T010 [US1] In `src/panels/resources-panel.ts`, call the unsubscribe function in `dispose()`

### Validation for User Story 1

- [ ] T011 [US1] Run `npm run typecheck` — confirm no errors in the two changed files
- [ ] T012 [US1] Manual visual validation: open `npm run dev`, load a `.sqlite` project → confirm the Resources panel renders the folder/file tree; expand and collapse two folders; confirm children appear and disappear correctly

**Checkpoint**: Resources panel shows the live file tree. Expand/collapse works. Story 1 independently validated.

---

## Phase 4: User Story 2 — Distinguish Folders from Files (Priority: P1)

**Goal**: Folder nodes and file nodes look visually different. Each file shows its name and type.

**Independent Validation**: Open a project with at least one folder containing files → confirm folders and files have distinct visual indicators and each file shows its type label.

### Implementation for User Story 2

- [ ] T013 [US2] In `src/panels/resources-panel.ts`, update `renderTree` so folder nodes render a toggle arrow (`▶` collapsed / `▼` expanded) and a folder icon or prefix before the name
- [ ] T014 [US2] In `src/panels/resources-panel.ts`, update file node rendering to show the file name followed by the type label (e.g. `image.png  [image/png]`)
- [ ] T015 [US2] In `src/panels/resources-panel.ts`, add minimal inline CSS or a `<style>` block for indentation, toggle arrows, and file/folder icon distinction — no external stylesheet or library

### Validation for User Story 2

- [ ] T016 [US2] Run `npm run typecheck` — confirm no new errors
- [ ] T017 [US2] Manual visual validation: open the dev server, load a project → confirm folder nodes and file nodes are visually distinguishable; confirm each file node shows name + type label

**Checkpoint**: Visual distinction complete. Stories 1 and 2 fully functional.

---

## Phase 5: User Story 3 — File Tree Visible on Application Launch (Priority: P2)

**Goal**: The Resources panel is already in the default layout and visible without any extra action from the user.

**Independent Validation**: Launch the app without opening a project → confirm Resources panel is visible and shows the empty-project placeholder. Open a project → confirm the tree appears automatically.

### Validation for User Story 3

- [ ] T018 [US3] Manual visual validation: launch dev server, do NOT open a project → confirm the Resources panel is visible in the workspace and shows "No project open" placeholder
- [ ] T019 [US3] Manual visual validation: open a `.sqlite` project → confirm the Resources panel populates the tree automatically without requiring any additional menu action
- [ ] T020 [US3] Confirm the placeholder text reads clearly (e.g. "No project open") and matches the spec requirement — update copy in `src/panels/resources-panel.ts` if needed

**Checkpoint**: Resources panel visible from launch, populates automatically. Story 3 validated.

---

## Phase 6: User Story 4 — Each Project Window Has Its Own File Tree (Priority: P2)

**Goal**: The Resources panel in each project window shows only the data from that window's database. Opening a second database does not affect the first window's tree.

**Independent Validation**: Open two projects (each in its own window). Confirm each Resources panel shows only its own project's files and operates independently.

**Note**: The current single-window architecture already handles this by construction — each shell instance owns its own `sessionRef` and `dbState`. This phase is primarily validation.

### Validation for User Story 4

- [ ] T021 [US4] Manual validation: open a first project → note its file tree. Open a second project (new window if multi-window is available, or validate isolation by re-loading a different file) → confirm the Resources panel updates to the new project without mixing data from the first
- [ ] T022 [US4] Confirm in `src/panels/panel-registry.ts` that the resources panel creator uses the `sessionRef` passed to the registry — not a global reference — to guarantee per-window isolation

**Checkpoint**: Per-window isolation confirmed. Story 4 validated.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 Run full compile/lint/typecheck pass: `npm run typecheck` (or project equivalent) — confirm zero new errors across the entire codebase
- [ ] T024 Run the project build: `npm run build` — confirm the static artifact builds cleanly with no new errors or warnings
- [ ] T025 [P] Review `src/panels/resources-panel.ts` for readability: confirm `buildTree`, `renderTree`, and the `dbState` subscription are clearly named and any non-obvious logic has a one-line comment (Constitution IV)
- [ ] T026 [P] Update `specs/006-project-file-explorer/checklists/requirements.md` — mark any newly validated items and add notes on findings from manual testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks all user story work
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 (builds on the same `renderTree` function)
- **Phase 5 (US3)**: Depends on Phase 4 — validates the fully rendered panel
- **Phase 6 (US4)**: Depends on Phase 4 — validates isolation with a working tree
- **Phase 7 (Polish)**: Depends on all story phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational (Phase 2)
- **US2 (P1)**: Depends on US1 — extends the same `renderTree` function
- **US3 (P2)**: Depends on US2 — validates the fully rendered panel from launch
- **US4 (P2)**: Depends on US2 — can run in parallel with US3

### Parallel Opportunities

- T013, T014, T015 within US2 can be worked together but all touch `resources-panel.ts`
- T025 and T026 in Phase 7 are fully parallel (different files)
- US3 (T018–T020) and US4 (T021–T022) can be validated in parallel once US2 is done

---

## Parallel Example: US2

```text
T013  Update folder node rendering (toggle arrow, icon) in resources-panel.ts
T014  Update file node rendering (name + type label) in resources-panel.ts
T015  Add minimal CSS for indentation and visual distinction in resources-panel.ts
```
(Sequential within the file — but can be reviewed in one sitting)

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1: Setup — verify baseline compiles (T001)
2. Phase 2: Foundational — wire dependencies (T002–T004)
3. Phase 3: US1 — build and render the tree (T005–T012)
4. Phase 4: US2 — add visual distinction (T013–T017)
5. **STOP and VALIDATE**: Manual visual check + typecheck
6. Ship: working file tree in Resources panel

### Incremental Delivery

1. Setup + Foundational → panel wired but still renders placeholder
2. US1 → live tree with expand/collapse
3. US2 → visual distinction + type labels
4. US3 → launch validation (no code change expected)
5. US4 → isolation validation (no code change expected)
6. Polish → clean build ready to ship

---

## Notes

- Both implementation phases (US1, US2) touch only `src/panels/resources-panel.ts`
- Only one line changes in `src/panels/panel-registry.ts` (Foundational phase)
- No new files, no new dependencies, no new directories
- Total tasks: 26 (including validation and polish)
