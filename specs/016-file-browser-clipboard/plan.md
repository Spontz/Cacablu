# Implementation Plan: File Browser Clipboard

**Branch**: `016-file-browser-clipboard` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Route clipboard commands by active editing context, store an application clipboard snapshot for Pool roots, implement atomic recursive copy/move operations in `DbSession`, and reuse scoped Phoenix asset reconciliation and shared Undo.

## Technical Context

**Language/Version**: TypeScript 5.x, ES2022 browser target  
**Primary Dependencies**: Existing Vite app, `sql.js`, Monaco, browser clipboard and drag APIs  
**Storage**: Loaded in-memory project database; no schema change  
**Testing**: Vitest and Playwright  
**Target Platform**: Browser with File System Access API  
**Performance Goals**: Immediate selection/cut feedback; atomic mutations without blocking pointer interaction  
**Constraints**: Static browser-only runtime; no native filesystem clipboard guarantee

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
