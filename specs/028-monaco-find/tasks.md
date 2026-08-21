# Tasks: Monaco Text Search

**Input**: Design documents from `/specs/028-monaco-find/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

## Phase 1: Planning And Shared Foundation

- [x] T001 Confirm all production Monaco creation sites in `src/panels/section-editor-panel.ts`, `src/panels/glsl-asset-editor-panel.ts`, and `src/panels/cam-asset-editor-panel.ts`.
- [x] T002 Document the lightweight `editor.api.js` contribution gap and selected built-in Monaco approach in `specs/028-monaco-find/research.md`.
- [x] T003 Create the shared Find contribution registration module in `src/panels/monaco-find.ts`.

---

## Phase 2: User Story 1 - Find Text In The Active Editor (Priority: P1)

**Goal**: `Ctrl/Cmd+F` opens Monaco-local search consistently in section, GLSL, and CAM editors while remaining unhandled outside Monaco.

**Independent Validation**: Focus each editor, activate Find, enter a query, inspect matches/options, then focus a non-editor control and verify Cacablu does not consume the shortcut.

- [x] T004 [US1] Register shared Monaco Find support in `src/panels/section-editor-panel.ts`.
- [x] T005 [P] [US1] Register shared Monaco Find support in `src/panels/glsl-asset-editor-panel.ts`.
- [x] T006 [P] [US1] Register shared Monaco Find support in `src/panels/cam-asset-editor-panel.ts`.
- [x] T007 [US1] Add real-browser coverage for shortcut scoping, widget opening, selected-query seeding, match counts, and search modes in `scripts/playwright-monaco-find-check.mjs`.
- [x] T008 [US1] Manually validate Find UI readability in all three editor types and record the result in this task list.

---

## Phase 3: User Story 2 - Navigate And Close Search (Priority: P1)

**Goal**: Users can move forward/backward, wrap through matches, close the widget, and resume editing without changing application state.

**Independent Validation**: Navigate repeated results in both directions, close with Escape, and compare content, Save state, dirty state, and Undo state before and after.

- [x] T009 [US2] Extend `scripts/playwright-monaco-find-check.mjs` with next/previous navigation, wrapping, Escape/focus restoration, repeated activation, and no-result coverage.
- [x] T010 [US2] Assert source content and application Undo state remain unchanged during the browser workflow.
- [x] T011 [US2] Manually validate coexistence with selection-occurrence highlighting and CAM column decorations and record the result in this task list.

---

## Phase 4: Validation And Completion

- [x] T012 Run `npm run typecheck` and resolve feature-related failures.
- [x] T013 Run `npm test` and resolve feature-related failures.
- [x] T014 Run `npm run lint` and resolve feature-related failures.
- [x] T015 Run `npm run build` and verify the static inlined artifact still builds.
- [x] T016 Run `node scripts/playwright-monaco-find-check.mjs` against the local Vite app.
- [x] T017 Reconcile implemented behavior with `specs/028-monaco-find/spec.md` and mark completed tasks.

## Dependencies & Execution Order

- T003 blocks T004-T007.
- T004-T006 together complete editor coverage for User Story 1.
- T007 provides the fixture extended by T009-T010.
- T012-T017 follow implementation and browser-test creation.

## Implementation Strategy

Deliver one small shared registration module first, integrate it into all three editors, then validate behavior through Monaco's actual browser UI. No new application state, custom search algorithm, or protocol layer is needed.

## Validation Record

- `npm run typecheck`: passed.
- `npm test`: passed, 38 files and 231 tests.
- Changed-file ESLint validation: passed for the shared module, three panel integrations, and Playwright script.
- `npm run lint`: feature files pass; the repository-wide command remains non-zero because of five unrelated pre-existing errors in `scripts/playwright-phoenix-connection-indicator-check.mjs`, `src/panels/demo-settings-dialog.ts`, and `src/phoenix/graphics-client.ts`.
- `npm run build`: passed, including the static inlined artifact; existing Mantine directive and bundle-size warnings remain.
- `scripts/playwright-monaco-find-check.mjs`: passed in Chromium for section, GLSL, and CAM editors, including Find options, navigation/wrapping, no results, focus return, shortcut scope, and state preservation.
- Manual visual review: passed from a full-page Chromium capture with the CAM Find widget open; widget controls/count and search highlights remain readable alongside CAM column colors and occurrence decorations.
