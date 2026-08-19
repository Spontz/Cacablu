# Implementation Plan: CAM Text Editor With Column Highlighting

**Branch**: `027-cam-text-editor` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/027-cam-text-editor/spec.md`

## Summary

Add a dedicated floating Monaco editor for `.cam` assets. A pure scanner derives whitespace-delimited token columns and Monaco decorations apply consistent column colors without modifying text. Save updates the existing project asset with UTF-8 bytes, registers exact-content Undo, and—only for enabled assets—uses the existing scoped Phoenix persisted-write contract so every dependent section is reloaded and reflected in Timeline/Events.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022  
**Primary Dependencies**: Existing Vite app, `dockview-core`, Monaco Editor, `sql.js` project session  
**Storage**: Existing in-memory `ProjectDatabase` through `DbSessionRef`; no schema change  
**Testing**: Vitest, TypeScript, ESLint, Vite production build, manual browser/Phoenix validation  
**Target Platform**: Modern desktop browser with File System Access API support  
**Project Type**: Static browser application  
**Performance Goals**: Decoration refresh remains imperceptible during normal CAM editing; one Save issues at most one asset write  
**Constraints**: Exact text preservation, one panel per asset, no direct SQLite/Phoenix filesystem access, no full sync  
**Scale/Scope**: Normal project CAM files, arbitrary row width, existing loaded Phoenix section set

## Constitution Check

- Static runtime preserved: PASS. Scanning, decoration, editing, and persistence orchestration run in browser code.
- No-server path preserved: PASS. Local editing works without Phoenix; built assets remain statically deployable.
- Real-time behavior protected: PASS. Scanning is linear in current text and uses Monaco's replacement decoration collection.
- File System Access compatibility addressed: PASS. The feature reuses the existing project workflow and baseline.
- Local engine contract defined: PASS. `contracts/cam-asset-save.md` documents request, response, partial failure, disabled, and offline behavior.
- Maintainability preserved: PASS. Column scanning and generic content Undo are isolated from panel orchestration.

## Project Structure

### Documentation

```text
specs/027-cam-text-editor/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/cam-asset-save.md
|-- tasks.md
`-- checklists/requirements.md
```

### Source Code

```text
src/
|-- panels/cam-asset-editor-panel.ts
|-- panels/cam-column-highlighting.ts
|-- panels/panel-registry.ts
|-- panels/resources-panel.ts
|-- services/resource-file-editor-undo.ts
|-- services/glsl-editor-undo.ts
|-- app/shell.ts
`-- styles/app.css
tests/unit/
|-- cam-column-highlighting.test.ts
`-- resource-file-editor-undo.test.ts
```

**Structure Decision**: Keep CAM-specific visual parsing in `panels`, generalize only the already shared resource-content Undo behavior, and reuse established shell, database, and Phoenix integration boundaries.

## Implementation Approach

1. Implement and test a pure horizontal-whitespace token scanner plus deterministic palette-class mapping.
2. Generalize the GLSL content snapshot/Undo helper behind resource-file names while retaining a compatibility re-export.
3. Add the CAM Monaco panel with live decoration replacement, stale identity/path checks, Save, conditional Phoenix write, Events, and Undo.
4. Route case-insensitive `.cam` double-clicks to one floating panel per file and register its renderer.
5. Add theme-compatible decoration colors and focused tests.
6. Run typecheck, tests, lint, build, and manual browser validation; record results in `tasks.md`.

## Complexity Tracking

No constitution violations.
