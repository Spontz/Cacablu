# Implementation Plan: Revert Saved Project

**Branch**: `031-project-revert` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

## Summary

Add `File > Revert` and a single discard confirmation policy. Extend `DbSession`
with a same-handle reload operation, construct the replacement before disposing
the live session, run immediate full Phoenix synchronization when connected,
then atomically publish the replacement and clear session-bound UI history.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022  
**Dependencies**: Existing File System Access handle, SQL.js session, menu shell, UndoManager, and project sync services  
**Storage**: Existing SQLite/SPZ project file; no new browser or database schema  
**Testing**: Vitest for decision policy and same-handle reload; existing full suite and manual connected validation  
**Constraints**: No new file picker, no backend, no replacement before read/sync success, no silent data loss

## Design

1. Add a pure confirmation policy returning `discard` or `cancel` after one prompt.
2. Add `DbSession.reload()` that rereads the captured file handle through the established database-opening path.
3. Keep the current session live while the replacement is opened and synchronized.
4. When Phoenix is connected, synchronize pool, demo settings, graphics, and forced sections from the temporary replacement.
5. Atomically swap `session` and `DbSessionRef`, dispose the predecessor, invalidate session-bound clipboard/Undo/selection state, and mark the database clean.
6. If Phoenix is offline, publish the replacement as pending through `ProjectSyncCoordinator`.
7. On any failure, dispose only the temporary session, restore coordinator ownership to the original session, and surface the error.

## Project Structure

```text
specs/031-project-revert/
├── spec.md
├── plan.md
└── tasks.md

src/app/project-revert.ts
src/app/shell.ts
src/db/db-session.ts
src/menu/menu-actions.ts
src/menu/menu-icon.ts
tests/unit/project-revert.test.ts
tests/unit/db-session.test.ts
```

## Constitution Check

- Static browser deployment is preserved.
- The existing project handle and synchronization contracts are reused.
- Destructive discard requires explicit confirmation.
- Session replacement remains recoverable until read and immediate sync succeed.
- No new runtime dependency or persistence format is introduced.
