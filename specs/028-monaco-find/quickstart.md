# Quickstart: Validate Monaco Text Search

## Automated checks

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

With the Vite development server running on port 5191:

```powershell
$env:CACABLU_E2E_URL = 'http://127.0.0.1:5191/'
node scripts/playwright-monaco-find-check.mjs
```

## Manual browser validation

1. Open a project with a Timeline section, a `.glsl` asset, and a `.cam` asset.
2. In each editor, select a repeated word and press `Ctrl+F` (`Cmd+F` on macOS).
3. Confirm the Monaco Find widget opens with the selected text and displays the expected match count.
4. Use Enter/Shift+Enter and the visible previous/next controls to navigate and wrap through matches.
5. Toggle match case, whole word, and regular-expression modes and confirm the results update.
6. Press Escape and confirm focus returns to the editor.
7. Confirm the document, dirty indicator, Save state, and Undo history did not change.
8. Focus a non-editor control and confirm Cacablu no longer consumes `Ctrl/Cmd+F`.
