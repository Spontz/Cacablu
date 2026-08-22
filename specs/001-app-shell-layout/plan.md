# Implementation Plan: Application Shell Layout

**Branch**: `001-app-shell-layout` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-app-shell-layout/spec.md`

**Note**: This plan establishes the first browser-only shell for Cacablu and is
intentionally limited to a static application skeleton plus extension points for
future engine integration.

## Summary

Create a static browser application shell that provides a top menu bar, a
dockable multi-panel workspace, placeholder panels for the core tool surfaces,
and a minimal browser-side connection layer ready for future WebSocket traffic
with the local visuals engine. The Events surface also owns a visible single
selection and publishes its selected description to the shell so `Edit > Copy`
and the native copy shortcut can use the correct plain-text payload.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vite, dockview-core  
**Storage**: N/A for initial shell  
**Testing**: TypeScript typecheck, lint, lightweight unit tests, manual visual validation  
**Target Platform**: Modern desktop browsers  
**Project Type**: Static web application  
**Performance Goals**: Shell visible quickly, panel interactions remain responsive, no obvious UI blocking during menu and layout actions  
**Constraints**: Browser-only runtime, no backend, open source dependencies only,
single window model, compatibility with modern browsers, local engine is
optional at startup, and floating panels must remain fully below the top menu
bar during drag, layout restore, and viewport resize
**Scale/Scope**: One application shell, one workspace layout, placeholder panels, initial connection state and message categories only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: the feature runs in the browser without requiring a
  backend or non-browser app process for UI logic.
- Real-time behavior protected: layout work remains lightweight and future heavy
  work can be moved off the main thread.
- Modern browser compatibility addressed: the shell relies on HTML5, CSS, and
  standard browser APIs available in modern browsers.
- Local engine contract defined: connection state and message categories are
  documented even though real engine handling is not yet implemented.
- Maintainability preserved: the shell is divided into app, layout, panel, menu,
  connection, and style modules with narrow responsibilities.
- Workspace safety preserved: floating-panel bounds are derived from the usable
  workspace below the menu bar, keeping panel title bars and close controls
  reachable during drag and after viewport or layout changes.

Post-design re-check: PASS. No designed element requires a backend, proprietary
software, or a non-open-source runtime dependency.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-shell-layout/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- websocket-shell-contract.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
src/
|-- app/
|   |-- bootstrap.ts
|   |-- shell.ts
|   `-- types.ts
|-- layout/
|   |-- dockview-workspace.ts
|   `-- default-layout.ts
|-- menu/
|   |-- menubar.ts
|   `-- menu-actions.ts
|-- panels/
|   |-- panel-registry.ts
|   |-- resources-panel.ts
|   |-- timeline-panel.ts
|   |-- preview-panel.ts
|   |-- inspector-panel.ts
|   `-- events-panel.ts
|-- state/
|   `-- app-state.ts
|-- ws/
|   |-- connection.ts
|   `-- messages.ts
|-- styles/
|   |-- app.css
|   `-- theme.css
`-- main.ts

tests/
`-- unit/
    |-- app-state.test.ts
    `-- messages.test.ts
```

**Structure Decision**: Single-project static web application. The shell is
organized around runtime concerns rather than feature folders so that layout,
menus, panels, and connection logic remain easy to reason about during the first
iterations.

### Events Clipboard Refinement

1. Keep the selected event id local to the mounted Events panel because it is
   transient UI state and must be discarded when that panel closes.
2. Notify the shell whenever the selected event or its plain-text description
   changes so Edit menu availability follows the visible selection.
3. Route `Edit > Copy` to the selected event before considering a previously
   focused text editor, then write only the event description as `text/plain`.
4. Preserve native partial-text copy when the browser has a non-collapsed text
   selection, and clear the clipboard selection when its event disappears.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
