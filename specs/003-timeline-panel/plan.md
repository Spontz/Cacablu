# Implementation Plan: Timeline Panel

**Branch**: `003-timeline-panel` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-timeline-panel/spec.md`

**Note**: This plan describes the timeline panel as a reusable timing surface
inside the shell, backed by a shared timeline package and validated through a
dedicated demo surface.

## Summary

Build a dense, studio-style timeline panel that can scrub from the ruler,
control playback through a transport bar, zoom with `Shift + wheel`, scroll
with the plain wheel, and evolve toward property keyframes and richer clip
editing. The implementation should keep the current static browser app usable
without a backend while organizing the timeline logic into a reusable package
and keeping the UI typography on a shared JetBrains baseline.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vite, dockview-core, existing browser DOM/CSS runtime  
**Storage**: N/A for v1; in-memory timeline state only  
**Testing**: Typecheck, lint, unit tests for timeline model/helpers, manual visual validation in the shell and local build  
**Target Platform**: Modern desktop browsers that satisfy the repository File System Access API baseline  
**Project Type**: Static web application with a reusable internal UI package  
**Performance Goals**: Maintain interactive scrubbing and transport feedback at roughly 60 fps, preserve scroll responsiveness, and avoid main-thread blocking during zoom and navigation interactions  
**Constraints**: Browser-only runtime, no backend dependency, static deployment, reusable package structure, support for local file opening of the built app, and browser baseline constrained by File System Access API support  
**Typography**: Shared JetBrains UI font baseline used by the shell and the studio demo surface  
**Scale/Scope**: One docked timeline panel in the shell, one reusable timeline package, and one demo surface for direct validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: the timeline runs in the browser and does not
  require a server or backend for UI logic.
- No-server path preserved: the delivered build remains openable from static
  files or local file access when the browser permits it.
- Real-time behavior protected: scrub, transport, selection, and zoom flows are
  designed to stay responsive and avoid avoidable blocking work.
- File System Access compatibility addressed: the feature inherits the host
  browser baseline and does not introduce a broader compatibility claim.
- Local engine contract defined: the panel must mirror and control a connected
  engine when present, but remain usable in demo mode without it.
- Maintainability preserved: the reusable package, shell panel, and demo surface
  stay separated with clear responsibilities.

Post-design re-check: PASS. The plan keeps the timeline inside the static
browser architecture and does not add server-side requirements.

## Project Structure

### Documentation (this feature)

```text
specs/003-timeline-panel/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- timeline-package-contract.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
apps/
`-- studio/
    |-- index.html
    |-- package.json
    |-- src/
    |   `-- main.ts
    `-- vite.config.ts

packages/
`-- timeline/
    |-- package.json
    |-- tsconfig.json
    `-- src/
        |-- index.ts
        |-- model.ts
        `-- utils.ts

src/
|-- app/
|-- layout/
|-- menu/
|-- panels/
|   `-- timeline-panel.ts
|-- state/
|-- styles/
`-- ws/

tests/
`-- unit/
```

**Structure Decision**: Keep the timeline as a reusable package in
`packages/timeline` while the shell consumes it through the existing docked
panel. Use `apps/studio` as a focused demo/validation surface without adding a
separate backend or editor application.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
