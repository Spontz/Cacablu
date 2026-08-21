# Implementation Plan: Monaco Text Search

**Branch**: `028-monaco-find` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-monaco-find/spec.md`

## Summary

Enable Monaco's built-in Find contribution for the section-script, GLSL, and CAM editors. A small shared module will load the existing Monaco find controller, while each production editor imports that module so dynamically loaded panel tests and application builds both register the contribution before editor creation. Monaco remains responsible for `Ctrl/Cmd+F`, query state, match options/counts, navigation, focus restoration, and disposal.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022  
**Primary Dependencies**: Existing `monaco-editor` 0.55.1 and Vite 7 application  
**Storage**: N/A; search state is transient editor UI state  
**Testing**: Vitest for existing unit suite; Playwright against real Monaco for focused browser behavior  
**Target Platform**: Modern desktop browser with the existing File System Access API baseline  
**Project Type**: Static browser application  
**Performance Goals**: Find opens and updates without perceptible delay for normal editor documents  
**Constraints**: No new runtime dependency; no global shortcut interception; no source, dirty-state, Save-state, or Undo mutation  
**Scale/Scope**: Three production Monaco editor types; one active document per search

## Constitution Check

*GATE: Passed before design and re-checked after design.*

- **Static runtime preserved**: the built-in contribution executes entirely inside the existing browser bundle.
- **No-server path preserved**: no backend, network request, or companion process is introduced.
- **Real-time behavior protected**: Monaco owns incremental matching and rendering; Cacablu adds no independent scanning loop.
- **File System Access compatibility addressed**: search itself requires no filesystem API and does not alter the existing project baseline.
- **Local engine contract defined**: not applicable; Phoenix and WebSocket messages are untouched.
- **Maintainability preserved**: one named side-effect module documents why the lightweight Monaco entrypoint needs the find contribution, and all editor integrations use the same module.

## Project Structure

### Documentation (this feature)

```text
specs/028-monaco-find/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── checklists/
    └── requirements.md
```

No protocol contract is created because the feature has no external or cross-process interface.

### Source Code (repository root)

```text
src/panels/
├── monaco-find.ts
├── section-editor-panel.ts
├── glsl-asset-editor-panel.ts
└── cam-asset-editor-panel.ts

scripts/
└── playwright-monaco-find-check.mjs
```

**Structure Decision**: Keep the registration module beside the three panel integrations it serves. Validate the actual Monaco widget and keyboard routing in a focused Playwright script rather than recreating Monaco internals in unit-test doubles.

## Implementation Approach

1. Import Monaco's `findController` contribution from a shared `monaco-find.ts` module.
2. Import that shared registration module in every production Monaco panel before calling `monaco.editor.create`.
3. Do not add a document/window key listener: Monaco's scoped keybinding service handles `Ctrl/Cmd+F`, while browser search remains untouched outside an editor.
4. Exercise section, GLSL, and CAM editors in one browser fixture and verify widget opening, match count, options, next/previous navigation, close/focus, shortcut scoping, and content/Undo preservation.
5. Run the complete TypeScript, unit, lint, production-build, and browser validation gates.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
