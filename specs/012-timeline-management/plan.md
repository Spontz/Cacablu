# Implementation Plan: Timeline Management

**Branch**: `012-timeline-management` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-timeline-management/spec.md`

## Summary

Make Cacablu's Timeline an editable project bar management surface. Timeline will render bars from the loaded SQLite project, support selection and core edit operations, persist committed edits through the project session, and schedule debounced Phoenix section synchronization when the engine is connected.
The first editing surface is a right-side Bar Editor opened from a selected timeline bar, allowing script and blend setting edits before broader drag/resize timeline operations are added.
The editor must provide real diagnostic feedback: section sync progress counters only advance for counted local work, bars with section sync errors are colored red, and Events remains a compact diagnostics surface.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022 through existing Vite setup  
**Primary Dependencies**: Existing Vite app, `dockview-core`, `packages/timeline`, browser File System Access APIs, native `fetch` and `WebSocket` APIs  
**Storage**: Loaded SQLite project database via existing `DbSession`; no new persistent schema expected  
**Testing**: Vitest unit tests for DB helpers, timeline state transforms, validation, and sync scheduling; manual browser validation with Phoenix  
**Target Platform**: Modern desktop browsers supported by the existing static app  
**Project Type**: Browser-only static web application  
**Performance Goals**: Drag/resize/selection remain responsive; Phoenix sync is debounced and does not run during every pointer move  
**Constraints**: No backend, no direct TCP from browser, no default bars/layers when empty, maintain all panels openable without project or engine, no synthetic progress counters in sync UI  
**Scale/Scope**: One loaded project, typical demo timeline bar counts, one local Phoenix instance for sync

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: PASS. The feature runs in browser code and uses existing project handles.
- No-server path preserved: PASS. Cacablu remains a static app.
- Real-time behavior protected: PASS. Timeline interactions are local and Phoenix sync is debounced.
- File System Access compatibility addressed: PASS. Persistence uses the existing project open/save flow.
- Local engine contract defined: PASS. Phoenix sync uses existing section manifest/replacement behavior documented in [contracts/timeline-management.md](./contracts/timeline-management.md).
- Maintainability preserved: PASS. DB mutation helpers, timeline UI, and sync scheduling remain separate.

## Project Structure

### Documentation (this feature)

```text
specs/012-timeline-management/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- timeline-management.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
src/
|-- app/
|   |-- shell.ts
|   `-- types.ts
|-- db/
|   |-- db-session.ts
|   |-- db-reader.ts
|   `-- db-writer.ts
|-- panels/
|   |-- timeline-panel.ts
|   |-- inspector-panel.ts
|   `-- section-editor-panel.ts
|-- services/
|   `-- project-section-sync.ts
|-- state/
|   `-- app-state.ts
packages/
`-- timeline/
    `-- src/
tests/
`-- unit/
```

**Structure Decision**: Add bar persistence helpers near the existing DB session/writer modules, keep timeline interactions in `timeline-panel.ts` and `packages/timeline`, and reuse `project-section-sync.ts` through a debounced scheduler owned by the app shell or a focused service.

## Phase 0: Research

Research is captured in [research.md](./research.md). Key decisions:

- The SQLite project remains the source of truth for bars.
- Timeline edits are committed locally first, then synced to Phoenix when possible.
- Phoenix sync is debounced and uses the existing full bar snapshot replacement pathway.
- Sync errors are Events, not edit rollbacks.
- Bar Editor opens from a single click and owns script/blend editing for selected bars.
- Blend Equation displays Add, Subtract, and Reverse subtract while storing Phoenix-compatible values.
- Timeline visual diagnostics include red errored bars and a playhead glow trail that fades when playback stops.
- Monaco overflow widgets are hosted at document level and assigned topmost stacking so Bar Editor popups cannot appear behind the timeline or Dockview panels.

## Phase 1: Design And Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/timeline-management.md](./contracts/timeline-management.md)
- [quickstart.md](./quickstart.md)

Post-design constitution check remains PASS.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
