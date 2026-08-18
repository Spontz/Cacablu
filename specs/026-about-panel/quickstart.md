# Quickstart: About Panel

## Automated Validation

```powershell
npm run typecheck
npx eslint vite.config.ts src/build-info.ts src/panels/about-panel.ts src/panels/panel-registry.ts src/layout/default-layout.ts src/menu/menu-actions.ts src/menu/menu-icon.ts src/app/shell.ts tests/unit/about-panel.test.ts
npx vitest run tests/unit/about-panel.test.ts
npm test
npm run build
```

Compare the embedded value with Git:

```powershell
git log -1 --format=%cd --date=format-local:'%Y-%m-%d %H:%M:%S'
Select-String -LiteralPath dist/index.html -Pattern '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'
```

## Manual Validation

1. Start Cacablu without opening a project and without Phoenix.
2. Open the Panels menu and select About.
3. Verify one panel titled About opens and contains the exact latest-commit timestamp.
4. Close and reopen it, then select About again while open and confirm no duplicate is created.
5. Verify the panel contains no other product metadata.

