# Implementation Plan: Project File Explorer

**Branch**: `006-project-file-explorer` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-project-file-explorer/spec.md`

## Summary

Replace the static placeholder in the existing Resources panel with a live, expandable file tree built from the `folders` and `files` arrays already present in the in-memory `ProjectDatabase`. Wire the panel using the same `dbState` + `sessionRef` pattern established by `db-explorer-panel` and `timeline-panel`. Only two source files change: `resources-panel.ts` (rewritten) and `panel-registry.ts` (updated to pass the two new dependencies).

## Technical Context

**Language/Version**: TypeScript (browser, targeting ES2020+)  
**Primary Dependencies**: `dockview-core` ^5.2.0 (panel layout), `sql.js` ^1.14.1 (already loaded by shell; not touched by this feature)  
**Storage**: In-memory `ProjectDatabase` provided via `DbSessionRef`; no direct SQLite access  
**Testing**: Vitest (project standard); manual visual verification required by constitution  
**Target Platform**: Browser — Chrome/Edge with File System Access API support  
**Project Type**: Browser-only static web application  
**Performance Goals**: Tree render must be instantaneous for expected project sizes (tens to low hundreds of files); no async work needed  
**Constraints**: No backend dependency; no new npm dependencies; read-only panel  
**Scale/Scope**: Single panel, two files changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Static runtime preserved** ✅ — The panel reads from an in-memory data structure. No backend, no server, no fetch calls.
- **No-server path preserved** ✅ — The Resources panel has no network dependency whatsoever.
- **Real-time behavior protected** ✅ — Tree construction from in-memory arrays is synchronous and instantaneous. No main-thread blocking. Expand/collapse is a pure DOM operation.
- **File System Access compatibility addressed** ✅ — This panel does not use the File System Access API. It depends on the session already opened by shell.ts.
- **Local engine contract defined** ✅ — This panel has no WebSocket interaction and no dependency on the local visuals engine.
- **Maintainability preserved** ✅ — Two files changed, following the identical pattern of existing panels. No new abstractions introduced.

**Result: All gates pass. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/006-project-file-explorer/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── resources-panel-contract.md   ← Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (via /speckit.tasks)
```

### Source Code (only files that change)

```text
src/
├── panels/
│   ├── resources-panel.ts     ← REWRITE: add dbState + sessionRef, render file tree
│   └── panel-registry.ts      ← UPDATE: pass dbState + sessionRef to resources panel
```

**Structure Decision**: Single-project layout. Only the panel layer is touched. No new files, no new directories, no new dependencies.

## Implementation Design

### resources-panel.ts — Full Rewrite

The panel constructor signature changes from `()` to `(dbState: DbState, sessionRef: DbSessionRef)`, matching `db-explorer-panel`.

**Internal state**:
```typescript
let expandedIds = new Set<number>();
```

**Tree construction** (called when `dbState` status becomes `'open'`):
```
1. const { folders, files } = sessionRef.current!.data
2. Build folderMap: Map<id, TreeNode> from folders
3. Assign each folder as child of its parent (or root if parent === 0/null)
4. Assign each file as child of its parent folder (or root if parent === 0/null/missing)
5. Collect root-level nodes
```

**Render**:
- If no DB: show `<p>No project open</p>`
- If tree is empty: show `<p>No files in project</p>`
- Otherwise: render `<ul>` recursively; folder nodes toggle `expandedIds` on click

**Lifecycle**:
```typescript
init(params) {
  const unsub = dbState.subscribe(snapshot => {
    if (snapshot.status === 'open') { buildTree(); render(); }
    else { expandedIds = new Set(); renderPlaceholder(); }
  });
  // render current state immediately
}
dispose() { unsub(); }
```

### panel-registry.ts — Minimal Update

Add `dbState` and `sessionRef` to the `case 'resources':` branch:
```typescript
case 'resources':
  return createResourcesPanel(dbState, sessionRef);
```

No other cases change.

## Complexity Tracking

*No constitution violations — table not applicable.*
