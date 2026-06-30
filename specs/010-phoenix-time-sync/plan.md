# Implementation Plan: Phoenix Time Sync

**Branch**: `main` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-phoenix-time-sync/spec.md`

## Summary

Connect Cacablu's timeline panel directly to Phoenix through the native editor WebSocket API. Cacablu will receive Phoenix runtime state, mirror the current time/playback state in the visible timeline playhead, and translate the five existing transport buttons into Phoenix runtime commands. The feature remains browser-only and does not add a backend.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022 through the existing Vite setup  
**Primary Dependencies**: Existing Vite app, dockview-core shell, reusable timeline package, native browser WebSocket API  
**Storage**: In-memory runtime state only; no new persistence  
**Testing**: Unit tests for message parsing/transport command mapping where practical, plus `npm run typecheck`, `npm run lint`, `npm run build`, and manual browser validation with Phoenix  
**Target Platform**: Modern desktop browsers supported by the existing static app  
**Project Type**: Browser-only static web application  
**Performance Goals**: Apply incoming runtime state without visible timeline jank; avoid re-render loops beyond Phoenix state updates and user commands  
**Constraints**: No backend, no direct TCP, no section or asset management in this slice, preserve existing project load/export flows  
**Scale/Scope**: One WebSocket connection to one local Phoenix instance, one docked timeline panel, five transport buttons

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: PASS. The feature uses browser-native WebSocket APIs only.
- No-server path preserved: PASS. Cacablu still has no backend; Phoenix is the local peer.
- Real-time behavior protected: PASS. Incoming runtime state is small and should update existing timeline state directly.
- File System Access compatibility addressed: PASS. No new file access is introduced.
- Local engine contract defined: PASS. The WebSocket contract is documented in `contracts/phoenix-runtime-websocket.md`.
- Maintainability preserved: PASS. Connection and message code remains separate from timeline rendering where possible.

## Project Structure

### Documentation (this feature)

```text
specs/010-phoenix-time-sync/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- phoenix-runtime-websocket.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
src/
|-- panels/
|   `-- timeline-panel.ts
|-- ws/
|   |-- connection.ts
|   `-- messages.ts
|-- state/
|   `-- app-state.ts
packages/
`-- timeline/
    `-- src/
        `-- model.ts
tests/
`-- unit/
```

**Structure Decision**: Extend the existing `src/ws` module for Phoenix WebSocket connection/message handling and keep the timeline panel responsible for rendering and dispatching transport actions. Avoid introducing a backend or a new app-level service unless the implementation needs shared lifecycle beyond the timeline panel.

## Phase 0: Research

Research is captured in [research.md](./research.md). Decisions:

- Use browser-native `WebSocket`.
- Use JSON runtime messages with a `type` discriminator.
- Keep one connection per Cacablu session for the first implementation.
- Use fixed one-second seek deltas for rewind/forward in this first slice.

## Phase 1: Design And Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/phoenix-runtime-websocket.md](./contracts/phoenix-runtime-websocket.md)
- [quickstart.md](./quickstart.md)

Post-design constitution check remains PASS:

- Cacablu remains static/browser-only.
- Phoenix is the only local runtime dependency.
- Transport commands are small JSON messages over WebSocket.
- Connection failure states are explicit and non-fatal.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
