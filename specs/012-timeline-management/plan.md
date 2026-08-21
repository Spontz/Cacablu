# Implementation Plan: Timeline Management

**Branch**: `012-timeline-management` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-timeline-management/spec.md`

## Summary

Make Cacablu's Timeline an editable project bar management surface. Timeline will render bars from the loaded SQLite project, support selection and core edit operations, persist committed edits through the project session, and schedule debounced Phoenix section synchronization when the engine is connected.
The first editing surface is a right-side Bar Editor opened from a selected timeline bar, allowing script and blend setting edits before broader drag/resize timeline operations are added.
The editor must provide real diagnostic feedback: section sync progress counters only advance for counted local work, bars with section sync errors are colored red, and Events remains a compact diagnostics surface.
The layer surface is implicit: any visible row can receive a bar, no empty layer entity or New Layer command is stored, and one full window of unused rows remains below occupied content while scrolling preserves the time grid.
Direct manipulation is selection-aware: Shift-click toggles bar membership, Shift-drag locks time while changing layers, bar-edge handles resize endpoints, and transient placement events keep Bar Editor times synchronized without persisting until release. Bar Editor Apply is in-place so an unchanged selection does not recreate Monaco, and remote script templates are downloaded from their canonical Dungeon routes without a checked-in fallback.

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

### Interaction Refinement Design

1. Treat pointer movement past the shared drag threshold as manipulation; treat a no-movement Shift gesture as selection toggling.
2. Capture pointer interaction on the stable Timeline panel root so rerenders during drag/resize cannot strand pointer state.
3. Store a time-lock flag for single and group drags. Once Shift activates the lock, horizontal pointer displacement contributes zero time delta for that gesture.
4. Publish transient bar-placement events for Bar Editor display only, then commit validated placement through the existing database, Undo, Timeline refresh, and deferred Phoenix sync path.
5. Keep the Bar Editor renderer keyed by project session and selection signature; republishing the same selected id after Apply does not dispose/recreate Monaco.
6. Route Enter from single-line inputs to the same Apply callback, while excluding Monaco targets so multiline script editing remains native.
7. Fetch `<barType>/<barType>.template` from the canonical raw Dungeon path in parallel with optional GitHub directory discovery and merge successful remote results with user-saved browser templates.

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

### Focused Browser Validation

`scripts/playwright-timeline-bar-drag-editor-check.mjs` exercises ordinary drag selection, live editor-time previews, Shift time locking, empty-space deselection, both resize edges, non-selectable labels, and Shift-click add/remove/clear transitions against real DOM pointer behavior.
