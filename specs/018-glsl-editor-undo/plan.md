# Implementation Plan: GLSL Editor Undo

**Branch**: `018-glsl-editor-undo` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Keep Monaco's character-level undo stack intact across persistence and snapshot the prior persisted resource into one shared `UndoManager` action after each changed successful GLSL Save.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Dependencies**: Monaco, existing `UndoManager`, `DbSession`, Phoenix asset operations  
**Storage**: Existing SQLite resource rows; no schema change  
**Testing**: Unit tests and real Monaco Playwright flow  
**Platform**: Browser with project file access

## Constitution Check

- Static browser runtime is preserved.
- Native text interaction remains immediate.
- Phoenix reconciliation is optional and explicit.
- Immutable snapshots and session validation keep history understandable and safe.

## Project Structure

```text
src/panels/glsl-asset-editor-panel.ts
src/app/undo-manager.ts
src/db/db-session.ts
src/phoenix/asset-operations.ts
tests/unit/
scripts/playwright-glsl-editor-undo-check.mjs
```

## Implementation Approach

1. Clone prior persisted content before a changed Save.
2. Suppress same-content model replacement so Monaco history survives.
3. Push one session-bound application Undo action after local success.
4. Restore locally first, refresh editor state, then reconcile Phoenix if connected.
