# Data Model: Project File Explorer

**Feature**: 006-project-file-explorer  
**Phase**: 1 — Design  
**Date**: 2026-05-05

## Source Entities (from ProjectDatabase)

These types are already defined in `src/db/db-schema.ts` and populated by `src/db/db-reader.ts`. No new schema work is needed.

### DbFolder

| Field     | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `id`      | number  | Unique folder identifier (PK)                    |
| `name`    | string  | Display name of the folder                       |
| `parent`  | number  | Parent folder id; 0 or null means root-level     |
| `enabled` | boolean | Whether the folder is active in the project      |

### DbFile

| Field     | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `id`      | number  | Unique file identifier (PK)                      |
| `name`    | string  | Display name of the file                         |
| `parent`  | number  | Parent folder id (FK → DbFolder.id); 0 or null = root |
| `bytes`   | number  | File size in bytes                               |
| `type`    | string  | MIME type or asset category                      |
| `data`    | Uint8Array | Raw binary content — **never read by this panel** |
| `format`  | string  | Encoding or format hint                          |
| `enabled` | boolean | Whether the file is active                       |

## UI-Only Entities (panel-local, not persisted)

### TreeNode

A unified node type used only inside `resources-panel.ts` to represent the rendered tree. Never leaves the panel.

| Field      | Type               | Description                                          |
|------------|--------------------|------------------------------------------------------|
| `kind`     | `'folder'|'file'`  | Discriminator                                        |
| `id`       | number             | Source entity id (DbFolder.id or DbFile.id)          |
| `name`     | string             | Display name                                         |
| `type`     | string \| null     | File type label (files only; null for folders)       |
| `children` | TreeNode[]         | Child nodes (folders only; empty array for files)    |

### ExpandState

| Field            | Type          | Description                                    |
|------------------|---------------|------------------------------------------------|
| `expandedIds`    | `Set<number>` | Set of folder ids currently expanded           |

**Behaviour**: Empty on panel init and on every DB reload. Click on a folder node toggles its id in the set and re-renders the subtree.

## Tree Construction Rules

1. Build a `Map<number, TreeNode>` from all `DbFolder` entries.
2. Add each `DbFolder` as a child of its `parent` folder node; if `parent` is 0 or falsy, place it at root.
3. Add each `DbFile` as a child of its `parent` folder node; if `parent` is 0 or falsy, place it at root.
4. If a `DbFile.parent` references an id not present in the folder map (broken reference), place the file at root.
5. Root-level nodes are rendered as the top-level list; nested nodes render under their parent when the parent is expanded.

## State Transitions

```
Panel init
  └─► empty tree + placeholder ("No project open")

dbState → 'open'
  └─► read sessionRef.current.data.{folders, files}
  └─► build TreeNode tree
  └─► expandedIds = new Set()
  └─► render tree

dbState → 'none' / 'error'
  └─► expandedIds = new Set()
  └─► render placeholder

User clicks folder node
  └─► toggle id in expandedIds
  └─► re-render affected subtree
```
