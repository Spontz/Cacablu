# Quickstart: Cross-Project Copy And Paste

## Automated Validation

```powershell
npm run typecheck
npm test
npm run build
```

Run focused tests:

```powershell
npx vitest run tests/unit/cross-project-clipboard.test.ts tests/unit/timeline-bar-paste.test.ts tests/unit/db-session.test.ts tests/unit/asset-clipboard.test.ts
```

Run two-tab browser validation:

```powershell
node scripts/playwright-cross-project-copy-paste-check.mjs
```

This script validates cross-project clipboard workflows. The dedicated
two-visible-window drag-and-drop regression described by T048 is still pending;
use the manual steps below for the cross-editor drag amendment meanwhile.

## Manual Validation

1. Open two Cacablu tabs with different copied project files.
2. In tab A, select bars across different times/layers and Copy.
3. In tab B, click an empty lane at a known time and confirm lane highlight/playhead.
4. Paste and verify new ids, complete properties, relative offsets, selection, save/reopen, and Undo.
5. Repeat after closing tab A.
6. Copy a nested Pool folder in tab A; paste at root, in a folder, and beside a file in tab B.
7. Compare hierarchy, bytes, metadata, enabled state, new ids, repeated Paste, save/reopen, and Undo.
8. Verify Monaco/input Copy/Paste remains native.
9. Verify mismatched payload contexts and destination conflicts make no mutation.
10. Repeat with Phoenix connected and disconnected.
11. Place two Cacablu editor windows side by side, each with a different project open.
12. Drag one file, a multi-selection, and a nested folder from Pool in editor A to the root, a folder, and beside a file in editor B.
13. Confirm editor B creates complete copies with new ids, editor A remains unchanged, and one Undo in B removes each complete dropped batch.
14. Repeat a drag with a destination name conflict and with the structured drag data removed; confirm neither project changes.
15. Drag a Pool file into Monaco and confirm only its normalized `/pool/...` path is inserted.
