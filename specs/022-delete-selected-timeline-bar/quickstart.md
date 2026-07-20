# Quickstart: Delete Selected Timeline Bars

## Automated Validation

From the Cacablu repository:

```powershell
npm run typecheck
npx vitest run tests/unit/bar-deletion.test.ts tests/unit/db-session.test.ts
npm test
npm run build
```

Run scoped lint for the changed files:

```powershell
npx eslint src/app/shell.ts src/db/db-session.ts src/panels/timeline-panel.ts src/services/bar-deletion.ts tests/unit/bar-deletion.test.ts tests/unit/db-session.test.ts
```

From the Phoenix repository:

```powershell
cmake --build phoenix_vs2026 --config Debug
```

## Browser Validation

1. Open a project containing at least three configured bars.
2. Select one bar, press `Delete`, and confirm it disappears and selection clears.
3. Invoke Edit > Undo and confirm the same bar, id, timing, layer, content, and selection return.
4. Select two bars, press `Backspace`, and confirm only those bars disappear.
5. Undo and confirm both return selected.
6. Focus a normal input and Monaco editor; confirm both keys edit text without deleting bars.
7. Repeat deletion and Undo while Phoenix is connected.
8. Confirm deleted sections and root `.spo` files disappear, then return after Undo for eligible bars.
9. Disconnect Phoenix and confirm deletion/Undo remain functional without disconnected-sync errors.
