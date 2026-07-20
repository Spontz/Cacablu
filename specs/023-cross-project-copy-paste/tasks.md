# Tasks: Cross-Project Copy And Paste

**Input**: Design documents from `/specs/023-cross-project-copy-paste/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cross-project-paste.md

## Phase 1: Clipboard Foundation

- [x] T001 [P] Define versioned bar/Pool clipboard envelope types in `src/services/cross-project-clipboard.ts`.
- [x] T002 [P] Implement bounded JSON/custom-MIME/HTML-fallback encoding and strict decoding.
- [x] T003 [P] Implement Pool `Uint8Array` base64 serialization with byte/path validation.
- [x] T004 Add unit coverage for round trips, corruption, unsupported versions, untrusted text, malformed paths, and binary limits.

## Phase 2: Context Routing

- [x] T005 Route native Copy/Paste by active Timeline, Resources, and editable-text context in `src/app/shell.ts`.
- [x] T006 Preserve normalized Pool plain-text fallback and native Monaco/input behavior.
- [x] T007 Add menu Paste reading through the browser Clipboard API with permission/error diagnostics.
- [x] T008 Reject bar/Pool payload context mismatches without project mutation.

## Phase 3: User Story 1 And 2 - Timeline Copy/Paste Target

- [x] T009 Add per-project selected Timeline paste layer to `src/app/types.ts`, `src/state/app-state.ts`, and project reset flow.
- [x] T010 Add simple lane-click time/layer selection and persistent selected-lane styling in `src/panels/timeline-panel.ts` and `src/styles/app.css`.
- [x] T011 Implement complete selected-bar snapshot capture and relative group anchor calculation.
- [x] T012 Implement deterministic target transformation and overlap/coordinate validation in `src/services/timeline-bar-paste.ts`.
- [x] T013 Add transactional multi-bar insertion with destination ids in `src/db/db-session.ts`.
- [x] T014 Integrate Timeline Paste, batch selection, one refresh, and one conflict-safe Undo action.
- [x] T015 Synchronize pasted/undone destination bars through existing Phoenix section APIs.
- [x] T016 Add unit coverage for target state, offsets, properties, new ids, overlap rollback, repeated Paste, Undo, and sync behavior.

## Phase 4: User Story 3 - Cross-Project Pool Copy/Paste

- [x] T017 Extend the Pool clipboard boundary to export/import self-contained copy payloads without a source session.
- [x] T018 Publish rich Pool payloads from keyboard, Edit menu, and item action menus while preserving text paths.
- [x] T019 Extend `src/panels/resources-panel.ts` Paste to accept decoded external roots and existing root/folder/file-parent destinations.
- [x] T020 Preserve atomic conflict checks, independent ids, one Undo batch, repeated Paste, and existing Phoenix asset reconciliation.
- [x] T021 Add unit coverage for source-tab independence, recursive binaries, canonical roots, destinations, conflicts, Undo, and sync.

## Phase 5: Browser And Quality Validation

- [x] T022 Add `scripts/playwright-cross-project-copy-paste-check.mjs` covering two tabs, lane targeting, bars, Pool trees, context routing, and source-tab closure.
- [x] T023 Run focused and complete unit suites.
- [x] T024 Run TypeScript typecheck and scoped ESLint for changed files.
- [x] T025 Run production build.
- [x] T026 Run two-tab browser/manual validation from `quickstart.md`.
- [x] T027 Update Spec Kit checklist and record final validation results.

## Validation Results

- `npm run typecheck`: passed.
- Scoped ESLint for every changed implementation, test, and browser-check file: passed.
- `npm test`: 28 files and 183 tests passed.
- `npm run build`: passed; only existing Mantine directive and bundle-size warnings were emitted.
- `node scripts/playwright-cross-project-copy-paste-check.mjs`: passed with two independent tabs for Timeline target/Paste/Undo and Pool Paste/Undo.
- Repository-wide `npm run lint`: the feature files pass, while three pre-existing files outside this change still report five unrelated errors.

## Follow-up: Selected Layer And Horizontal Editing Tail

- [x] T028 Highlight the complete selected layer in yellow behind Timeline bars.
- [x] T029 Select the layer when clicking either its empty area or one of its bars.
- [x] T030 Add one viewport width of horizontal editing space after Timeline content.
- [x] T031 Validate real-time selection and bar creation inside the horizontal tail.

Follow-up validation: the two-tab Playwright check confirms selection from a real mouse click on an empty lane, yellow selection from a bar click, and successfully creates a bar beyond the previous content end while retaining another full viewport of trailing editing space.

## Closure

- **Status**: Closed
- **Closed**: 2026-07-20
- **Result**: All planned and follow-up tasks are complete; automated unit, type, lint, build, and two-tab browser validations passed.

## Dependencies & Execution Order

- Clipboard codec precedes all cross-tab routing.
- Timeline target/DB insertion precede Timeline Paste integration.
- Pool external-root decoding precedes Resources integration.
- Browser validation follows both payload kinds.

## Parallel Opportunities

- Codec tests, Timeline placement tests, and DB transaction tests affect separate modules.
- Pool integration can proceed after envelope types while Timeline target UI is developed.
- Typecheck/unit tests and browser fixture preparation can run independently.
