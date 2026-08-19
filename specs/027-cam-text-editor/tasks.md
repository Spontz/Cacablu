# Tasks: CAM Text Editor With Column Highlighting

**Input**: Design documents from `/specs/027-cam-text-editor/`  
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/cam-asset-save.md

## Phase 1: Shared Foundations

- [x] T001 [P] [US2] Implement pure CAM token-column scanning and palette mapping in `src/panels/cam-column-highlighting.ts`.
- [x] T002 [P] [US2] Add scanner coverage for spaces, tabs, mixed whitespace, blank/irregular rows, and edits in `tests/unit/cam-column-highlighting.test.ts`.
- [x] T003 [P] [US3] Generalize resource file-content snapshot and Undo behavior in `src/services/resource-file-editor-undo.ts`, retaining the GLSL compatibility boundary.
- [x] T004 [P] [US3] Add generic exact-byte, stale-session, and removed-file Undo tests in `tests/unit/resource-file-editor-undo.test.ts`.

## Phase 2: User Story 1 - Open And Edit A CAM File

- [x] T005 [US1] Implement the asset-bound floating Monaco panel in `src/panels/cam-asset-editor-panel.ts`.
- [x] T006 [US1] Register `cam-asset-editor-panel` in `src/panels/panel-registry.ts`.
- [x] T007 [US1] Route case-insensitive CAM double-clicks from `src/panels/resources-panel.ts` through a dedicated shell event.
- [x] T008 [US1] Open/focus one floating CAM panel per file identity in `src/app/shell.ts`.

## Phase 3: User Story 2 - Identify Data Columns Visually

- [x] T009 [US2] Connect live Monaco decoration replacement to CAM model changes in `src/panels/cam-asset-editor-panel.ts`.
- [x] T010 [US2] Add theme-compatible CAM column palette styles in `src/styles/app.css`.

## Phase 4: User Story 3 - Save And Refresh Phoenix Dependents

- [x] T011 [US3] Persist UTF-8 CAM drafts through `DbSessionRef`, mark dirty, and register one Undo action in `src/panels/cam-asset-editor-panel.ts`.
- [x] T012 [US3] Gate scoped Phoenix writes on the current file's enabled state and connection state, then apply existing asset-impact Events/Timeline handling.
- [x] T013 [US3] Apply the same enabled/connection policy when Undo restores prior CAM bytes.
- [x] T014 [US3] Handle missing/stale targets, offline saves, write failures, and disabled assets without full project synchronization.

## Phase 5: Validation And Closure

- [x] T015 Run focused CAM and resource-file Undo tests.
- [x] T016 Run `npm run typecheck`, scoped ESLint, the complete unit suite, and `npm run build`.
- [ ] T017 Manually validate the workflow in `quickstart.md`, including connected Phoenix dependent reloads.
- [ ] T018 Record validation results, mark completed tasks, and set the feature spec status to Implemented.

## Validation Results

- `npm run typecheck`: passed after the final implementation change.
- Focused validation: 4 files and 17 tests passed, including CAM parsing/save policy, generic Undo, and the GLSL compatibility boundary.
- `npm test`: 38 files and 231 tests passed.
- Scoped ESLint for every changed TypeScript/test file: passed.
- `npm run lint`: executed; the repository-wide command remains blocked by five pre-existing errors in `scripts/playwright-phoenix-connection-indicator-check.mjs`, `src/panels/demo-settings-dialog.ts`, and `src/phoenix/graphics-client.ts`. No changed feature file reports an error.
- `npm run build`: passed; only the existing Mantine directive and bundle-size warnings were emitted.
- Browser smoke validation at `http://127.0.0.1:5173/`: the static app loaded, reported Phoenix connected, and produced no console errors.
- Full CAM editor/Phoenix visual validation remains pending because the browser automation cannot supply a file to the native File System Access picker; no project database was already open in the browser.

## Dependencies & Execution Order

- T001-T004 establish independently testable foundations.
- T005-T008 deliver opening/editing and depend on the generic helper interface from T003.
- T009-T010 depend on the CAM panel and scanner.
- T011-T014 depend on the panel plus existing Phoenix asset-impact services.
- T015-T018 close the feature only after implementation.
