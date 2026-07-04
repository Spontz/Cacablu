# Implementation Plan: Graphics Settings Config

**Branch**: `013-graphics-settings-config` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/013-graphics-settings-config/spec.md`

## Summary

Add a Cacablu Graphics panel opened from `Edit > Graphics`. The panel edits rendering context settings and the 25 generic Phoenix FBO rows, validates them locally, updates the loaded project graphics state, and sends the complete normalized configuration to Phoenix. Phoenix owns applying the settings and writing `data/config/graphics.spo`.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022 through existing Vite setup  
**Primary Dependencies**: Existing Vite app, Dockview shell, browser `fetch`, project DB session helpers, Events state  
**Storage**: Loaded SQLite project graphics variables and FBO rows; no new persistent browser storage required  
**Testing**: Vitest for normalization and validation; Playwright/manual browser validation with Phoenix connected and disconnected  
**Target Platform**: Modern desktop browsers supported by the existing static app  
**Project Type**: Browser-only static web application  
**Performance Goals**: Dialog editing remains responsive for 25 FBO rows; OK request is one complete payload  
**Constraints**: No direct write to Phoenix data folder, no alerts for errors, maintain Cacablu as a static app  
**Scale/Scope**: One graphics configuration per loaded project, 25 Phoenix generic FBO rows

## Constitution Check

- Static runtime preserved: PASS. Uses browser UI, project data, and existing Phoenix HTTP API.
- No-server path preserved: PASS. Cacablu does not add a backend.
- Real-time behavior protected: PASS. Graphics transmission occurs on OK, not during table edits.
- File System Access compatibility addressed: PASS. Project persistence reuses existing database flow; Phoenix writes its own file.
- Local engine contract defined: PASS. Contract captured in [contracts/graphics-settings.md](./contracts/graphics-settings.md).
- Maintainability preserved: PASS. UI, normalization, validation, and API client responsibilities remain separate.

## Project Structure

### Documentation (this feature)

```text
specs/013-graphics-settings-config/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- graphics-settings.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
src/
|-- app/
|   `-- shell.ts
|-- db/
|   |-- db-session.ts
|   `-- db-writer.ts
|-- panels/
|   `-- graphics-settings-dialog.ts
|-- services/
|   `-- phoenix-graphics-config.ts
|-- state/
|   `-- app-state.ts
tests/
`-- unit/
```

## Phase 0: Research

Research is captured in [research.md](./research.md). Key decisions:

- Cacablu sends one complete graphics payload on OK.
- Phoenix, not Cacablu, writes `data/config/graphics.spo`.
- The FBO table has 25 rows to match Phoenix `FBO_BUFFERS`.
- Rows `0..19` are ratio-based; rows `20..24` use explicit width and height.
- Errors go to Events and keep the panel open.

## Phase 1: Design And Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/graphics-settings.md](./contracts/graphics-settings.md)
- [quickstart.md](./quickstart.md)

Post-design constitution check remains PASS.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

