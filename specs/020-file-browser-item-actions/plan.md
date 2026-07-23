# Implementation Plan: File Browser Item Actions And Undo

**Branch**: `020-file-browser-item-actions` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Replace direct delete controls with captured-target ellipsis menus, add validated database mutations and immutable inverse payloads, make direct multi-item/folder drag reuse the same reversible move command model, and reconcile enabled path changes through existing Phoenix operations after local success.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Dependencies**: DOM, `sql.js`, shared UndoManager and asset clipboard  
**Storage**: Existing Pool database rows; no schema change  
**Testing**: Unit/integration tests and Playwright  
**Platform**: Browser with File System Access API  
**Constraints**: Atomic local mutations, stable targets, destination-before-delete Phoenix ordering

## Constitution Check

- Static browser runtime and existing database model are preserved.
- First-click UI remains immediate.
- Phoenix communication uses documented existing contracts and stays optional.
- Validation, immutable payloads, and focused helpers protect maintainability.

## Project Structure

```text
src/panels/resources-panel.ts
src/db/db-session.ts
src/app/undo-manager.ts
src/resources/asset-clipboard.ts
src/services/resource-clipboard-sync.ts
src/phoenix/asset-operations.ts
src/styles/app.css
tests/unit/
scripts/playwright-file-browser-item-actions-check.mjs
```

## Implementation Approach

1. Add validated create/rename/delete/restore database operations.
2. Store focused reversible command payloads and preflight Undo conflicts.
3. Render a captured-target document overlay with actions, separators, and icons.
4. Publish complete destinations, resend rewritten sections, then remove obsolete Phoenix paths.
5. Verify all mutations, Undo, menu lifecycle, and clipping behavior.
6. Represent each successful internal batch drag as one history entry containing every original parent, so its inverse restores the complete move atomically.
