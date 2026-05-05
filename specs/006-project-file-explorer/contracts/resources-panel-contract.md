# Contract: Resources Panel (Project File Explorer)

**Feature**: 006-project-file-explorer  
**Contract Type**: Internal UI panel contract  
**Date**: 2026-05-05

## Panel Identity

| Property    | Value                  |
|-------------|------------------------|
| Panel id    | `resources`            |
| Component   | `resources`            |
| Title       | `Resources`            |
| Location    | Left column, default workspace layout |

## Dependencies Injected at Construction

The panel creator in `panel-registry.ts` MUST receive and forward:

| Parameter    | Type           | Purpose                                              |
|--------------|----------------|------------------------------------------------------|
| `dbState`    | `DbState`      | Subscribe to DB open/close events to trigger re-render |
| `sessionRef` | `DbSessionRef` | Read `sessionRef.current.data.folders` and `.files` when status is `'open'` |

This matches the identical contract already used by `db-explorer-panel` and `timeline-panel`.

## DbState Subscription Contract

The panel MUST subscribe to `dbState` on `init()` and unsubscribe on `dispose()`.

| `DbSnapshot.status` | Panel behaviour                                      |
|---------------------|------------------------------------------------------|
| `'open'`            | Build tree from `sessionRef.current.data`, render it |
| `'none'`            | Clear tree, show "No project open" placeholder       |
| `'opening'`         | Optionally show loading indicator; tree not yet valid |
| `'error'`           | Clear tree, show error placeholder                   |
| `'saving'` / `'saved'` / `'dirty'` | No change to tree; DB data unchanged |

## Read Contract

The panel reads ONLY:
- `sessionRef.current.data.folders: DbFolder[]`
- `sessionRef.current.data.files: DbFile[]`

The panel MUST NOT read `DbFile.data` (BLOB). It MUST NOT write to any field of `sessionRef.current.data`.

## Render Contract

The panel renders into its dockview-provided container element. Output is a DOM tree of `<ul>/<li>` elements. No external libraries are used.

| UI element      | Behaviour                                               |
|-----------------|---------------------------------------------------------|
| Folder node     | Shows toggle arrow (▶ collapsed / ▼ expanded) + folder icon + name |
| File node       | Shows file icon + name + type label                     |
| Empty project   | Shows single placeholder line: "No project open"        |
| Empty tree      | Shows single placeholder line: "No files in project"    |
| Click on folder | Toggles expand/collapse; re-renders that subtree only   |

## Lifecycle Contract

```
createContentRenderer() → returns { element, init(), dispose() }
  init(params)
    ├─ subscribe to dbState → store unsubscribe fn
    └─ render current state immediately

  dispose()
    └─ call stored unsubscribe fn
```

## What This Panel Does NOT Do

- Does not open or save database files
- Does not read or display BLOB data
- Does not communicate with the local visuals engine (no WebSocket messages)
- Does not modify any application state (read-only consumer)
- Does not require the File System Access API
