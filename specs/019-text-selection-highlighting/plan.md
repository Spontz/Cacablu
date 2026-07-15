# Implementation Plan: Text Selection Occurrence Highlighting

**Branch**: `019-text-selection-highlighting` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Install one shared Monaco helper that finds bounded literal matches for the current selection and owns a disposable decoration collection used by section-script and GLSL editors.

## Technical Context

**Language/Version**: TypeScript 5.x and CSS  
**Dependencies**: Existing lightweight Monaco editor API  
**Storage**: N/A  
**Testing**: Unit helpers and Playwright with real Monaco  
**Platform**: Browser  
**Performance Goals**: Immediate bounded recomputation during selection/editing

## Constitution Check

- Static runtime is preserved.
- Match work is bounded and local to the active model.
- One shared helper and disposer keep lifecycle logic maintainable.
- No engine or filesystem dependency is introduced.

## Project Structure

```text
src/editor/selection-occurrences.ts
src/panels/section-editor-panel.ts
src/panels/glsl-asset-editor-panel.ts
src/styles/app.css
tests/unit/
scripts/playwright-*-editor-check.mjs
```

## Implementation Approach

1. Read the selected literal and find bounded case-sensitive model matches.
2. Exclude the primary range and update a single decoration collection.
3. Subscribe to selection/content changes and return one complete disposer.
4. Install the helper in both production editor lifecycles and share styling.
