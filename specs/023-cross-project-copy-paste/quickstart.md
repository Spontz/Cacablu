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
