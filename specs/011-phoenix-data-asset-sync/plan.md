# Implementation Plan: Phoenix Data Asset Sync

**Branch**: `011-phoenix-data-asset-sync` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/011-phoenix-data-asset-sync/spec.md`

## Summary

Add Cacablu-side synchronization for the loaded project's database-backed pool/resources assets and timeline bars. Cacablu will require a loaded project before sync, compare enabled project pool files with Phoenix's active engine manifest, clean and republish Phoenix pool when it differs, compare serialized project bars with Phoenix runtime sections, replace Phoenix sections when they differ, and send explicit file/directory operations to Phoenix for allowed asset paths. The feature remains browser-only and builds on the existing Phoenix connection patterns.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2022 through the existing Vite setup  
**Primary Dependencies**: Existing Vite app, dockview-core shell, File System Access APIs, native browser `fetch` and `WebSocket` APIs  
**Storage**: In-memory sync state plus the loaded project database session; no new persistent database schema required  
**Testing**: Unit tests for manifest comparison, path normalization, and operation formatting where practical, plus `npm run typecheck`, `npm run lint`, `npm run build`, and manual browser validation with Phoenix  
**Target Platform**: Modern desktop browsers supported by the existing static app and File System Access workflow  
**Project Type**: Browser-only static web application  
**Performance Goals**: Manifest comparison should keep the UI responsive for typical project asset trees; large-file hashing and transfer should surface progress or non-blocking state where practical  
**Constraints**: No backend, no direct TCP from the browser, no writes without loaded project context, no `config` sync, preserve existing time sync/preview flows  
**Scale/Scope**: One loaded project, one local Phoenix instance, initial publication of enabled pool files, initial full replacement of runtime sections when serialized bars differ, operations under `pool` and `resources` only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: PASS. The feature uses browser-native filesystem, HTTP, and WebSocket APIs only.
- No-server path preserved: PASS. Cacablu still has no backend; Phoenix is the local peer.
- Real-time behavior protected: PASS. Asset sync is not frame-time critical and remains separate from timeline runtime state.
- File System Access compatibility addressed: PASS. Sync requires a loaded project database and does not ask for Phoenix destination folder access.
- Local engine contract defined: PASS. The Phoenix asset and section contract is documented in `contracts/phoenix-asset-sync.md`.
- Maintainability preserved: PASS. Manifest/path/client helpers should stay separate from panel rendering.

## Project Structure

### Documentation (this feature)

```text
specs/011-phoenix-data-asset-sync/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- tasks.md
|-- contracts/
|   `-- phoenix-asset-sync.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
src/
|-- app/
|   `-- shell.ts
|-- panels/
|   `-- resources-panel.ts
|-- state/
|   `-- app-state.ts
|-- ws/
|   |-- connection.ts
|   `-- messages.ts
|-- phoenix/
|   |-- asset-client.ts
|   |-- asset-manifest.ts
|   |-- asset-paths.ts
|   `-- section-client.ts
|-- services/
|   `-- project-section-sync.ts
tests/
`-- unit/
```

**Structure Decision**: Add focused Phoenix asset and section sync helpers under Phoenix/client and service modules rather than embedding manifest, path, HTTP operation, and bar serialization logic directly in panel code. Reuse existing connection state where possible, but keep project-open sync state independent from timeline time sync.

## Phase 0: Research

Research is captured in [research.md](./research.md). Decisions:

- Gate all sync and transfer behavior on loaded project state.
- Represent expected published pool files and Phoenix asset trees as normalized manifests.
- Compare initial pool manifests by normalized relative path and size metadata.
- Send explicit operations rather than uploading entire subtrees.
- Serialize database bars into Phoenix-compatible section payloads and use full section replacement on mismatch rather than browser-side incremental patching.
- Treat `config` and path traversal attempts as blocked before sending to Phoenix.

## Phase 1: Design And Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/phoenix-asset-sync.md](./contracts/phoenix-asset-sync.md)
- [quickstart.md](./quickstart.md)

Post-design constitution check remains PASS:

- Cacablu remains static/browser-only.
- Phoenix is the only local runtime peer.
- File transfer requires project context.
- Section replacement requires project context and runs after pool sync completes or is skipped.
- Asset sync is scoped to `pool` and `resources`.
- Existing time sync and preview remain separate.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
