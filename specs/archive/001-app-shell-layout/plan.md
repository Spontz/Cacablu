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
with the local visuals engine.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vite, dockview-core  
**Storage**: N/A for initial shell  
**Testing**: TypeScript typecheck, lint, lightweight unit tests, manual visual validation  
**Target Platform**: Modern desktop browsers  
**Project Type**: Static web application  
**Performance Goals**: Shell visible quickly, panel interactions remain responsive, no obvious UI blocking during menu and layout actions  
**Constraints**: Browser-only runtime, no backend, open source dependencies only, single window model, compatibility with modern browsers, local engine is optional at startup  
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

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
