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
