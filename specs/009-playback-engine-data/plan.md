# Implementation Plan: Playback Engine Data Export

**Branch**: `009-playback-engine-data` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-playback-engine-data/spec.md`

## Summary

Add a playback preparation flow that keeps all transport controls disabled until a SQLite project is loaded, enables only Play after a valid project is open, and uses the browser's local folder write capability to create `data/pool` in the user-selected visualization engine folder. The implementation will reuse the existing browser-only TypeScript app, extract the Pool panel tree-building logic into a shared model/export utility, and write the SQLite resource files into matching folders under `data/pool`.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2020+ with current `tsconfig` target ES2022  
**Primary Dependencies**: Existing Vite app, `dockview-core` panel shell, `sql.js` project database session, no new runtime dependency planned  
**Storage**: In-memory `ProjectDatabase` from `DbSessionRef`; local `data/pool` directory and files written through browser File System Access APIs  
**Testing**: Vitest unit tests via `npm test`, typecheck via `npm run typecheck`, lint via `npm run lint`, build via `npm run build`  
**Target Platform**: Static browser application in desktop browsers with File System Access support  
**Project Type**: Browser-only static web application  
**Performance Goals**: Transport state updates within 500 ms after project load; export of typical resource trees without visible UI freeze  
**Constraints**: No backend service, no direct SQLite access from panel/export code, preserve local-file/static-host operation, avoid starting playback before export succeeds  
**Scale/Scope**: Current single-window app; resource export covers the `folders` and `files` tables already represented in the Pool panel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: PASS. The feature uses existing browser code and local browser file permissions only.
- No-server path preserved: PASS. Export is initiated by user interaction and does not require an HTTP backend.
- Real-time behavior protected: PASS. Export happens only on Play preparation and should be factored into small synchronous tree construction plus one async file write.
- File System Access compatibility addressed: PASS. The feature requires folder selection/write support and will show a clear unsupported-browser message when unavailable.
- Local engine contract defined: PASS. No WebSocket messages or engine launch are introduced; the contract is the local `data/pool` directory written into the selected engine folder.
- Maintainability preserved: PASS. Shared resource-tree serialization will be extracted from panel rendering instead of duplicating DOM-oriented tree code.

## Project Structure

### Documentation (this feature)

```text
specs/009-playback-engine-data/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- engine-data-file.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- app/
|   `-- shell.ts
|-- db/
|   |-- db-schema.ts
|   `-- db-session.ts
|-- panels/
|   |-- resources-panel.ts
|   `-- timeline-panel.ts
|-- services/
|   `-- engine-data-export.ts
|-- state/
|   `-- db-state.ts
`-- resources/
    `-- resource-tree.ts

tests/
`-- unit/
    |-- engine-data-export.test.ts
    |-- resource-tree.test.ts
    `-- timeline-transport.test.ts
```

**Structure Decision**: Keep the feature in the existing single browser app. Add `src/resources/resource-tree.ts` for reusable tree construction/serialization and `src/services/engine-data-export.ts` for browser folder selection plus `data` file writing. Update `timeline-panel.ts` to consume project readiness and call the export service instead of toggling playback immediately.

## Phase 0: Research

Research is captured in [research.md](./research.md). All technical unknowns are resolved with project-local decisions:

- Use browser folder selection/write APIs as the primary workflow.
- Write SQLite resource file bytes into a `data/pool` folder tree.
- Treat Play as "prepare playback" until engine launch/playback is specified later.
- Share resource-tree construction between Pool panel and export service.

## Phase 1: Design And Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/engine-data-file.md](./contracts/engine-data-file.md)
- [quickstart.md](./quickstart.md)

The post-design constitution check remains PASS:

- Static runtime remains browser-only with no backend.
- File System Access dependency is explicit and validated in UI behavior.
- Export format is documented and does not require a live engine.
- The main thread does only bounded tree traversal before an async file write.
- Module boundaries keep UI rendering, tree modeling, and filesystem export separate.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
