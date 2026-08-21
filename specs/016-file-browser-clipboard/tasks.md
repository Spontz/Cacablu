# Tasks: File Browser Clipboard

## Selection And Clipboard

- [x] T001 Add canonical multi-selection and application clipboard snapshots.
- [x] T002 Publish normalized `/pool/...` text and preserve native text paste.
- [x] T003 Render pending Cut roots at 50% opacity and invalidate them on clipboard replacement.

## Mutations And Destinations

- [x] T004 Add atomic recursive copy and move operations with conflict/self/descendant validation.
- [x] T005 Add explicit Pool-root Paste and drag/drop destinations.
- [x] T006 Insert Pool paths when pasting or dropping into Monaco editors.
- [x] T007 Integrate Copy/Paste and Cut/Paste with Undo and Phoenix reconciliation.

## Verification

- [x] T008 Add unit coverage for snapshots, path normalization, validation, and lifecycle.
- [x] T009 Add Playwright coverage for keyboard/menu clipboard, opacity, root destinations, and editor paste/drop.
- [x] T010 Run typecheck, lint, tests, and production build.
- [x] T011 Manually verify the browser workflow with a loaded project.

## Internal Drag Moves

- [x] T012 Build modern batch drag payloads from canonical selection while accepting the legacy single-file payload.
- [x] T013 Make both file and folder rows draggable and add clear grab/dragging affordances.
- [x] T014 Treat a folder row, its contained files, and visible whitespace inside its expanded subtree as the same exact folder destination.
- [x] T015 Move selected roots atomically through `DbSession.moveResourceItems`, preserve selection, create one Undo entry, and reconcile all affected Phoenix paths after commit.
- [x] T016 Extend Edge Playwright coverage for multi-file drag, folder-subtree drag, inner-folder drop targets, preserved selection, and Undo in `scripts/playwright-assets-dnd-check.mjs`.
- [x] T017 Add native Selenium Edge validation with an actual SQLite project in `scripts/selenium-edge-folder-dnd-check.mjs`.

## External Import Conflicts

- [x] T018 Detect case-insensitive file/folder conflicts before importing an external file.
- [x] T019 Show an accessible Cancel/Replace dialog for same-name files and keep cancellation side-effect free.
- [x] T020 Replace existing content through `updateResourceFileContent` while preserving id, path, parent, name, and enabled state.
- [x] T021 Add unit and Edge regression coverage for conflict detection, cancellation, identity-preserving replacement, and Phoenix ordering.

## Cross-Editor Drag Copies

- [x] T022 Publish a self-contained bounded Pool subtree snapshot and source-editor identity in drag data.
- [x] T023 Distinguish same-editor move from cross-editor copy and allocate destination-owned ids for copied batches.
- [x] T024 Reuse root/folder/file-parent destinations, atomic conflicts, one destination Undo action, and destination-only Phoenix reconciliation.
- [x] T025 Preserve normalized `/pool/...` path insertion for editable drop targets.
- [ ] T026 Add two-window browser coverage for file, multi-root, nested-folder, stripped payload, conflicts, source preservation, Undo, and editable path drops.
- [x] T027 Add source-session identity to Pool drag routing so only an exact editor/session match can move original ids.
- [x] T028 Add unit regression coverage for different project sessions with overlapping resource ids in `tests/unit/resource-drag-origin.test.ts`.

## Same-Folder Copy Naming And Repeated Drag Reliability

- [x] T029 Allocate `-1`, `-2`, and the next free suffix before a copied file extension when source and destination folders are identical.
- [x] T030 Reserve generated names across the current copy batch and compare sibling conflicts case-insensitively without overwriting files or folders.
- [x] T031 Preserve existing conflict behavior for folder copies, moves, imports, and cross-editor copies.
- [x] T032 Clear stale internal drag state at the start of every gesture and keep local drag functional when optional rich-transfer publication fails.
- [x] T033 Ensure system-clipboard paste reuses the local snapshot for same-project copies so same-folder numbering is applied consistently.
- [x] T034 Add unit coverage for numbered copies and browser coverage for consecutive Pool drag/drop gestures.

## Latest Validation

- `npm run typecheck`: passed.
- Focused drag-origin, cross-project clipboard, and resource-tree tests: 9 passed.
- `npm run build`: passed with pre-existing non-blocking bundle warnings.
- Two-window cross-editor drag regression: pending (T026).
