# Implementation Plan: File Browser Clipboard

**Branch**: `016-file-browser-clipboard` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Route clipboard commands by active editing context, store self-contained Pool snapshots, implement atomic recursive copy/move operations in `DbSession`, preserve same-editor drag as move, add cross-editor drag as independent copy, and make external duplicate imports an explicit confirmed content update with scoped Phoenix reconciliation.

## Technical Context

**Language/Version**: TypeScript 5.x, ES2022 browser target  
**Primary Dependencies**: Existing Vite app, `sql.js`, Monaco, browser clipboard and DragEvent/DataTransfer APIs
**Storage**: Loaded in-memory project database; no schema change  
**Testing**: Vitest, Edge Playwright, and native Selenium Edge against an actual SQLite project
**Target Platform**: Browser with File System Access API  
**Performance Goals**: Immediate selection/cut feedback; atomic mutations without blocking pointer interaction  
**Constraints**: Static browser-only runtime; no native filesystem clipboard guarantee; cross-editor drag is copy-only and must not depend on live source-editor memory at drop time

## Constitution Check

- Static runtime and no-server delivery are preserved.
- Clipboard and database work stay local to the browser.
- Phoenix is optional and uses existing explicit asset contracts.
- Validation occurs before mutation; operations remain readable and atomic.

## Project Structure

```text
src/resources/asset-clipboard.ts
src/resources/asset-selection.ts
src/services/resource-clipboard-sync.ts
src/panels/resources-panel.ts
src/app/shell.ts
src/db/db-session.ts
scripts/playwright-pool-clipboard-check.mjs
tests/unit/
```

## Implementation Approach

1. Canonicalize selections and snapshot immutable clipboard roots plus normalized text paths.
2. Route commands between text editing and Resources without intercepting native paste incorrectly.
3. Apply recursive copy/move plans atomically with destination validation.
4. Reconcile enabled paths with Phoenix after local success and add focused Undo payloads.
5. Verify root paste/drop, editor paste/drop, stale/conflicting operations, and clipboard lifecycle.
6. Build internal drag payloads from the canonical selection when the dragged item is selected, while retaining legacy single-file payload compatibility.
7. Resolve a drop anywhere inside an expanded folder to that folder and execute the batch with `DbSession.moveResourceItems` as one atomic operation.
8. Preserve moved selection, register one inverse Undo command, reconcile Phoenix after commit, and verify both synthetic and native Edge pointer flows.
9. Detect external import conflicts case-insensitively, reject folder conflicts, and show a modal Cancel/Replace choice for file conflicts before mutation.
10. Replace only file content metadata so database identity and enabled state remain stable, then delegate ordered Phoenix publication to the asset-sync service.
11. Publish a bounded recursive Pool snapshot plus source-editor and source-session identities at drag start; route only an exact editor/session match to atomic move and every foreign or changed session to atomic copy with destination-owned ids.
12. Verify two-window file, multi-root, and folder drags, exact destinations, source preservation, conflicts, one-step destination Undo, editable path drops, and destination-only Phoenix reconciliation.
13. Add a regression proving that overlapping numeric resource ids in different project sessions cannot route a cross-project drop through the local move path.
14. Before a same-project file copy returns to its source folder, clone only the affected clipboard root names and allocate the lowest free `-N` suffix before the final extension; keep folder and cross-editor collision rules unchanged.
15. Reset internal drag state at every `dragstart`, publish the lightweight local move payload first, and treat rich recursive `DataTransfer` publication as optional for same-tab moves so one failed or completed gesture cannot poison the next.
