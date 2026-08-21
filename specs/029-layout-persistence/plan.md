# Implementation Plan: Persistent Workspace Layout

**Branch**: `029-layout-persistence` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

## Summary

Persist Dockview's complete serialized workspace in `localStorage` behind a versioned envelope. Restore it during workspace mount, listen to Dockview's aggregate layout-change event for automatic updates, and safely fall back when browser storage or saved data is unavailable. Project opening will preserve an established layout instead of closing and rebuilding its panels at default positions.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022  
**Primary Dependencies**: Existing `dockview-core` 5.2.0 and Vite application  
**Storage**: Browser `localStorage`, key `cacablu.workspace.layout`, schema version 1  
**Testing**: Vitest for storage policy; Playwright with real Dockview for save/restore behavior  
**Constraints**: Static browser-only deployment; storage failures are non-fatal; no new dependency

## Design

1. Add a pure `workspace-layout-storage.ts` boundary that validates a versioned envelope and catches every Storage/JSON failure.
2. During `DockviewWorkspace.mount`, read and restore the saved Dockview payload before subscribing to new layout changes.
3. Subscribe to `onDidLayoutChange` and write `dockview.toJSON()` immediately so the latest completed Dockview mutation is durable.
4. Track whether a saved/restored or current-session layout preference exists, including an empty layout.
5. During project opening, leave existing panels mounted so their state subscriptions can refresh against the new session. Only open the legacy Timeline/Pool defaults when no layout preference has ever been established.
6. If parsing, validation, or `fromJSON` fails, remove the entry and use the existing empty initial workspace.

## Project Structure

```text
specs/029-layout-persistence/
├── spec.md
├── plan.md
└── tasks.md

src/layout/
├── workspace-layout-storage.ts
└── dockview-workspace.ts

tests/unit/
└── workspace-layout-storage.test.ts

scripts/
└── playwright-layout-persistence-check.mjs
```

## Constitution Check

- Static deployment remains intact.
- Storage is origin-local and optional.
- No project database or Phoenix protocol is changed.
- Dockview remains the authority for layout serialization and restoration.
- Failures degrade to the established first-run workspace.
