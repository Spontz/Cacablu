# Implementation Plan: Command Menu Icons

**Branch**: `021-command-menu-icons` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Create one internal SVG path catalogue and DOM factory, then integrate it into main-menu popup items and Pool action items while leaving top-level menu-bar triggers text-only.

## Technical Context

**Language/Version**: TypeScript 5.x and CSS  
**Dependencies**: Browser SVG DOM only; no new package  
**Storage**: N/A  
**Testing**: Playwright structural/behavioral regressions  
**Platform**: Browser  
**Constraints**: Decorative accessibility, compact layout, unchanged commands

## Constitution Check

- Static runtime and bundle portability are preserved.
- DOM work is small and bounded to menu creation.
- A shared factory avoids duplicated markup and dependencies.
- Accessibility and existing interaction contracts remain intact.

## Project Structure

```text
src/menu/menu-icon.ts
src/menu/menubar.ts
src/panels/resources-panel.ts
src/styles/app.css
scripts/playwright-command-menu-icons-check.mjs
scripts/playwright-file-browser-item-actions-check.mjs
```

## Implementation Approach

1. Define mapped stroke glyphs, aliases, fallback, and decorative SVG attributes.
2. Add an icon column before popup command labels and flex alignment in Pool items.
3. Keep menu-bar trigger rendering as plain text.
4. Verify mapping completeness, fallback, accessibility, labels, disabled states, separators, and click behavior.
