# Quickstart: Validate CAM Text Editing

## Automated Validation

```powershell
npm run typecheck
npx vitest run tests/unit/cam-column-highlighting.test.ts tests/unit/resource-file-editor-undo.test.ts
npm test
npm run lint
npm run build
```

## Manual Browser Validation

1. Open a project containing an enabled `.cam` asset referenced by at least two Timeline sections.
2. Double-click the asset and confirm one floating editor opens with its current content.
3. Confirm values in the same whitespace-delimited column share a color across rows; test spaces, tabs, and mixed separators.
4. Edit separators and values and confirm colors update immediately without changing unrelated characters.
5. Double-click the same asset again and confirm the existing editor receives focus.
6. Save while Phoenix is connected; confirm the database becomes dirty, the Phoenix file changes, and all dependent sections report reload outcomes.
7. Undo and confirm exact prior content is restored locally and in connected Phoenix.
8. Disable the asset, edit, and save; confirm no Phoenix asset request is made.
9. Re-enable it, disconnect Phoenix, edit, and save; confirm the local save succeeds and Events shows one warning.
10. Confirm no browser console errors and no full project synchronization occurs.
