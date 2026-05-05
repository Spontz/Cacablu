# Research: Project File Explorer

**Feature**: 006-project-file-explorer  
**Phase**: 0 — Outline & Research  
**Date**: 2026-05-05

## Decision 1: Panel Wiring Pattern

**Decision**: Follow the identical pattern used by `db-explorer-panel` and `timeline-panel`.  
**Rationale**: Both panels receive `dbState: DbState` and `sessionRef: DbSessionRef` from `panel-registry.ts`, subscribe to `dbState`, and read from `sessionRef.current.data` when status becomes `'open'`. Resources panel is currently the only panel that receives no dependencies — this spec closes that gap by wiring it the same way.  
**Alternatives considered**: Global event bus (unnecessary complexity given existing pub/sub), passing `ProjectDatabase` directly by value (breaks on future multi-project architecture since the reference model is the established pattern).

## Decision 2: Tree Data Source

**Decision**: Read `ProjectDatabase.folders` (`DbFolder[]`) and `ProjectDatabase.files` (`DbFile[]`) directly from the in-memory session. No new queries needed.  
**Rationale**: `db-reader.ts` already reads FOLDERS and FILES tables into the `ProjectDatabase` model on every `openDbSession()` call. The data is immediately available on `sessionRef.current.data` when `dbState` status is `'open'`.  
**Alternatives considered**: Re-querying sql.js directly at render time (redundant, breaks the existing reader abstraction, exposes WASM internals to UI code).

## Decision 3: Tree Construction Algorithm

**Decision**: In-memory recursive tree built at render time from `folders` and `files` arrays using a `Map<number, ...>` for O(1) parent lookups.  
**Rationale**: File counts in Cacablu projects are small (tens to low hundreds). No virtualization or lazy loading is needed. Building the tree once per DB open is the simplest correct approach.  
**Alternatives considered**: Sorting into a flat list with indent metadata (simpler initial render but harder to implement expand/collapse correctly), lazy loading subtrees (unnecessary given small data size).

## Decision 4: Expand/Collapse State

**Decision**: Manage expand/collapse state as a `Set<number>` of expanded folder ids stored inside the panel instance. Collapsed by default; user clicks toggle.  
**Rationale**: Expand state is UI-only and panel-local. It does not need to survive DB reloads (tree resets on new DB open). Using a `Set<number>` keyed by folder id is the minimal correct representation.  
**Alternatives considered**: Persisting expand state across DB switches (premature), expanding all by default (poor UX for large trees).

## Decision 5: Multi-Project Window Architecture

**Decision**: This spec implements the file tree for the single active project session. The multi-project window architecture (1 DB = 1 window) is a separate architectural concern outside the scope of this spec.  
**Rationale**: The current shell supports one session at a time (`sessionRef.current`). The panel wiring model (DbSessionRef per panel-registry instance) is already window-scoped by construction — each shell instance owns its own registry, state, and session. When multi-window support is added in a future spec, the Resources panel will naturally isolate because it reads from its own window's sessionRef.  
**Alternatives considered**: Blocking this feature on multi-window architecture (unnecessary delay; the single-window implementation is already correct in the multi-window model).

## Decision 6: Visual Representation

**Decision**: Plain HTML tree rendered as nested `<ul>/<li>` elements with CSS indentation. Folder nodes show a toggle arrow (▶/▼) and a folder icon; file nodes show the file name and type label. No external tree-component library.  
**Rationale**: Consistent with the existing panel implementations (db-explorer, timeline) which use plain DOM construction via `createContentRenderer`. Introducing a tree library would add a dependency for a feature that is straightforward with native DOM.  
**Alternatives considered**: Third-party tree component (adds dependency, inconsistent with existing panel style), Canvas-rendered tree (excessive complexity for a simple list).

## Resolved: No NEEDS CLARIFICATION Items

All open questions from the spec were resolved by inspecting the existing codebase:
- Wiring pattern: confirmed from db-explorer-panel.ts
- Data availability: confirmed from db-schema.ts and db-reader.ts
- State notification: confirmed from dbState pub/sub in shell.ts
- Scope boundary: multi-window deferred to future spec, single-window implementation is already architecturally correct
