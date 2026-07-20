# Implementation Plan: Delete Selected Timeline Bars

**Branch**: `022-delete-selected-timeline-bar` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/022-delete-selected-timeline-bar/spec.md`

## Summary

Move selected-bar deletion out of the mounted Timeline panel and into a shared application command. Resolve selected existing bars at execution time, delete them locally, register one complete Undo snapshot, and synchronize the committed result through Phoenix's existing section APIs. Add a transactional `DbSession` restoration operation so Undo cannot partially recreate a multi-bar deletion.

## Technical Context

**Language/Version**: TypeScript 5.x targeting ES2022  
**Primary Dependencies**: Existing Vite shell, `sql.js`, shared app state, shared Undo manager, Phoenix section client  
**Storage**: Existing in-memory `DbSession` backed by the opened SQLite project; no schema migration  
**Testing**: Vitest unit and integration tests, TypeScript typecheck, scoped ESLint, production build, Phoenix Debug build  
**Target Platform**: Modern desktop browser with File System Access support  
**Project Type**: Browser-only static application with an optional local Phoenix engine  
**Performance Goals**: Local deletion and Timeline refresh complete synchronously with the keypress; network work remains asynchronous  
**Constraints**: No backend, no new runtime dependency, no new Phoenix endpoint, no partial multi-row restoration, no interception of text-editor deletion  
**Scale/Scope**: One active project, one selected bar set, and one local Phoenix instance

## Constitution Check

- Static runtime preserved: PASS. All editing logic remains browser-side.
- No-server path preserved: PASS. Phoenix is optional and local edits work disconnected.
- Real-time behavior protected: PASS. Database work is bounded and Phoenix synchronization is asynchronous.
- File System Access compatibility addressed: PASS. The feature reuses the existing open/save workflow and adds no new browser requirement.
- Local engine contract defined: PASS. [contracts/section-deletion.md](./contracts/section-deletion.md) documents delete, restore, ordering, and degraded behavior.
- Maintainability preserved: PASS. Selection/deletion/sync utilities live in a focused service; database atomicity remains in `DbSession`; application orchestration remains in the shell.

## Project Structure

### Documentation

```text
specs/022-delete-selected-timeline-bar/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- section-deletion.md
`-- checklists/
    `-- requirements.md
```

### Source Code

```text
src/
|-- app/
|   `-- shell.ts
|-- db/
|   `-- db-session.ts
|-- panels/
|   `-- timeline-panel.ts
`-- services/
    `-- bar-deletion.ts
tests/
`-- unit/
    |-- bar-deletion.test.ts
    `-- db-session.test.ts
```

**Structure Decision**: Keyboard ownership and Undo orchestration belong to the application shell so deletion works independently of Timeline panel lifecycle. Selection filtering and Phoenix request behavior are isolated in `bar-deletion.ts`. SQL transaction ownership stays in `db-session.ts`.

## Implementation Approach

1. Add a shared service for shortcut recognition, editable-target detection, selection resolution, snapshot cloning, and Phoenix delete/restore calls.
2. Add `DbSession.restoreTimelineBars` with conflict preflight, explicit SQL transaction, rollback, and post-commit in-memory update.
3. Route menu and global keyboard deletion through the shell and remove bar deletion ownership from the Timeline panel.
4. Commit local deletion first, clear selection, emit one Timeline refresh, and start asynchronous Phoenix deletion.
5. Register one Undo action that restores complete snapshots, reselects them, waits for in-flight deletion, and republishes eligible bars.
6. Preserve local state and report affected ids if a connected request fails; silently skip network work when disconnected.
7. Validate pure behavior, persistence, atomic conflicts, publication filtering, disconnected operation, and delete-before-restore ordering.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
