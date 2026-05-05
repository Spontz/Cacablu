# Quickstart: Project File Explorer

**Feature**: 006-project-file-explorer  
**Date**: 2026-05-05

## What Was Built

The Resources panel now displays a live file tree of the currently loaded project. Folders can be expanded and collapsed. Each file shows its name and asset type. The panel stays empty until a project is opened.

## How to Test It

1. Run the dev server: `npm run dev`
2. Open the app in the browser
3. The Resources panel is visible on the left side of the workspace
4. Without a project loaded: the panel shows "No project open"
5. Use **File → Abrir** to open a `.sqlite` project file
6. The Resources panel immediately populates with the folder/file tree from that project
7. Click any folder to expand or collapse it
8. Open a second project via **File → Abrir** — a second project window opens independently; each window shows its own file tree

## Files Changed

| File | Change |
|------|--------|
| `src/panels/resources-panel.ts` | Rewritten: receives `dbState` + `sessionRef`, builds and renders file tree |
| `src/panels/panel-registry.ts` | Updated: passes `dbState` + `sessionRef` to the resources panel creator |

## Files NOT Changed

- `src/db/db-schema.ts` — `DbFolder` and `DbFile` types already exist
- `src/db/db-reader.ts` — already reads FOLDERS and FILES tables
- `src/layout/default-layout.ts` — panel definition unchanged
- `src/layout/dockview-workspace.ts` — layout unchanged
- `src/app/shell.ts` — session and state wiring unchanged

## Key Patterns Used

The Resources panel follows the identical pattern as `db-explorer-panel`:
- Receives `dbState` and `sessionRef` from the panel registry
- Subscribes to `dbState` in `init()`, unsubscribes in `dispose()`
- Reads `sessionRef.current.data.folders` and `.files` when `status === 'open'`
- Re-renders to placeholder when `status` is `'none'` or `'error'`
