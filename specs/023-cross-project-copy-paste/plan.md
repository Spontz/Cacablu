# Implementation Plan: Cross-Project Copy And Paste

**Branch**: `023-cross-project-copy-paste` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/023-cross-project-copy-paste/spec.md`

## Summary

Introduce a versioned, self-contained Cacablu clipboard envelope that survives source-tab closure and carries either complete Timeline bar snapshots or recursive Pool resource snapshots. Route native Copy/Paste by active context, add an explicit selected Timeline layer paired with current time, paste bars atomically with relative time/layer offsets and new ids, and extend existing Pool copy/paste to decode cross-tab snapshots. Every destination paste is one Undo action and synchronizes through existing Phoenix clients only after local commit.

## Technical Context

**Language/Version**: TypeScript 5.x targeting ES2022  
**Primary Dependencies**: Existing Vite app, `sql.js`, DOM Clipboard events, Clipboard API fallback, shared Undo manager, Phoenix section/asset clients  
**Storage**: Independent loaded SQLite `DbSession` per browser tab; no schema migration  
**Testing**: Vitest for serialization, validation, placement, atomic DB operations, Undo helpers, and sync routing; Playwright two-tab browser validation  
**Target Platform**: Chromium-class desktop browser supporting File System Access and user-initiated clipboard events  
**Project Type**: Browser-only static application with optional local Phoenix  
**Performance Goals**: Lane selection and local paste feedback within one interaction frame for normal projects; recursive payload validation before mutation; no synchronous Phoenix dependency  
**Constraints**: No backend, no source-session dependency, no cross-tab Cut, no automatic dependency inference, no overwrite/merge/auto-shift on conflicts  
**Scale/Scope**: One copied batch at a time; typical demo bar groups and Pool subtrees; bounded clipboard payload decoding

## Constitution Check

- Static runtime preserved: PASS. Transfer uses browser clipboard formats and static application code.
- No-server path preserved: PASS. Tabs exchange no backend messages.
- Real-time behavior protected: PASS. Local selection/mutations are bounded; engine work is post-commit.
- File System Access compatibility addressed: PASS. Each project reuses its existing open/save handle.
- Local engine contract defined: PASS. [contracts/cross-project-paste.md](./contracts/cross-project-paste.md) documents existing API reuse and failure behavior.
- Maintainability preserved: PASS. Clipboard codec, bar placement, DB transactions, UI routing, and Phoenix sync have separate responsibilities.

## Project Structure

### Documentation

```text
specs/023-cross-project-copy-paste/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- cross-project-paste.md
`-- checklists/
    `-- requirements.md
```

### Source Code

```text
src/
|-- app/
|   |-- shell.ts
|   `-- types.ts
|-- db/
|   `-- db-session.ts
|-- panels/
|   |-- timeline-panel.ts
|   `-- resources-panel.ts
|-- resources/
|   `-- asset-clipboard.ts
|-- services/
|   |-- cross-project-clipboard.ts
|   `-- timeline-bar-paste.ts
`-- state/
    `-- app-state.ts
tests/
`-- unit/
    |-- cross-project-clipboard.test.ts
    |-- timeline-bar-paste.test.ts
    `-- db-session.test.ts
scripts/
`-- playwright-cross-project-copy-paste-check.mjs
```

**Structure Decision**: The system clipboard codec is independent of UI panels. The shell owns context routing. Timeline owns the current-time/layer interaction and visual target. `DbSession` owns atomic row insertion. Resources reuses its existing subtree capture, destination resolution, Undo, and Phoenix reconciliation with decoded external roots.

## Implementation Approach

1. Encode a strict envelope with application id, schema version, kind, and payload. Write it to a custom MIME type and an HTML fallback while preserving useful `text/plain`.
2. Decode only bounded, well-shaped envelopes. Convert Pool binary data to/from base64 and normalize/validate all paths and declared byte lengths.
3. Handle trusted native `copy`/`paste` events globally outside editable targets; use `navigator.clipboard.read()` for menu Paste where supported.
4. Add `timelinePasteLayer` to shared app state, clear it on project change, and update it from simple empty-lane clicks. Current Timeline time remains the time coordinate.
5. Compute bar group placement from earliest source start and minimum source layer. Reject invalid/overlapping batches before one transactional insert.
6. Allocate destination ids in SQLite, select the pasted batch, register conflict-safe Undo, refresh Timeline once, and publish eligible sections through existing sync.
7. Let Resources accept decoded copy roots in addition to its same-tab in-memory clipboard. Preserve normal root/folder/file-parent destination rules and existing recursive atomic insert/Undo/sync behavior.
8. Validate source-tab independence, repeated Paste, mismatched context, corruption, large/binary data, collision rollback, and connected/disconnected behavior.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
