# Implementation Plan: Image Preview in Inspector

**Branch**: `007-image-preview-inspector` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/007-image-preview-inspector/spec.md`

## Summary

Connect the existing Resources file explorer to the existing Inspector panel through a small project-window selection state. File and folder clicks in Resources update the current resource selection; Inspector reads that selection plus `sessionRef.current.data.files` and shows either an image preview, a non-image/folder state, an empty state, or a preview-unavailable state. Image bytes are already loaded in `DbFile.data`, so the implementation can create browser object URLs from the in-memory database without backend calls, direct filesystem access, or new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2020+  
**Primary Dependencies**: `dockview-core` ^5.2.0 for panels/layout, `sql.js` ^1.14.1 for already-loaded project database sessions  
**Storage**: In-memory `ProjectDatabase` exposed through `DbSessionRef`; no direct SQLite queries in panel code  
**Testing**: Vitest for selection/image utility logic; project `npm test`, `npm run lint`, and `npm run build`; manual visual verification required  
**Target Platform**: Browser static app, primarily Chrome/Edge-class browsers with File System Access API support for opening project DBs  
**Project Type**: Browser-only static web application  
**Performance Goals**: Inspector preview updates within 1 second for typical embedded project images; selection changes should feel immediate  
**Constraints**: No backend, no server dependency, no new runtime dependencies, read-only asset preview, object URLs must be revoked when replaced/disposed  
**Scale/Scope**: Existing Resources and Inspector panels plus a small shared state module and focused tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Static runtime preserved**: Pass. The preview reads bytes already present in the browser memory model and renders with browser-native image support.
- **No-server path preserved**: Pass. No network, backend, or companion process is introduced.
- **Real-time behavior protected**: Pass. Resource selection is synchronous UI state; preview generation is limited to object URL creation from existing bytes and avoids heavy decoding work in application code.
- **File System Access compatibility addressed**: Pass. This feature does not call File System Access APIs directly; it depends on the existing database-open workflow.
- **Local engine contract defined**: Pass. The feature has no WebSocket or local visuals engine dependency.
- **Maintainability preserved**: Pass. The design keeps selection state explicit, panel-local responsibilities narrow, and image detection/URL creation testable.

**Result: All gates pass. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/007-image-preview-inspector/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- inspector-image-preview-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md                  # Created later by /speckit.tasks
```

### Source Code (expected change surface)

```text
src/
|-- app/
|   `-- types.ts              # Add resource selection snapshot types if AppState owns selection
|-- state/
|   |-- app-state.ts          # Add project-window resource selection state and subscriptions
|   `-- app-state.test.ts     # Existing pattern; tests live under tests/unit
|-- panels/
|   |-- resources-panel.ts    # Mark/select folders/files and publish selection
|   |-- inspector-panel.ts    # Render image preview/fallback from selection + sessionRef
|   `-- panel-registry.ts     # Pass sessionRef/dbState/state as needed
|-- db/
|   `-- db-schema.ts          # No schema change expected; DbFile.data already exists
`-- styles/
    `-- app.css               # Add resource selected state and inspector preview styles

tests/
`-- unit/
    |-- app-state.test.ts
    `-- image-preview.test.ts # New focused tests for image detection/blob metadata helper if extracted
```

**Structure Decision**: Single browser app layout. Keep the feature in the existing panel/state layers; do not introduce a new package or dependency.

## Implementation Design

### Shared Resource Selection State

Add a project-window resource selection to the existing state layer because Resources and Inspector already share the same `AppState` instance from `shell.ts`.

Selection shape:

```typescript
type ResourceSelection =
  | { kind: 'none' }
  | { kind: 'folder'; id: number; name: string }
  | { kind: 'file'; id: number; name: string; fileType: string };
```

State rules:

- Initial selection is `{ kind: 'none' }`.
- Selecting a folder or file in Resources replaces the previous selection.
- Opening/clearing a DB resets selection to `{ kind: 'none' }` so stale previews cannot survive project changes.
- Selection is scoped to the shell/project-window instance because every project window owns its own state instance.

### Resources Panel

Extend existing rendered nodes with selectable rows:

- Folder row click keeps existing expand/collapse behavior and also publishes folder selection.
- File row click publishes file selection.
- Current selection gets a stable selected CSS state.
- File rows receive ids in DOM data attributes so event handling can resolve the selected file from the in-memory tree.

### Inspector Panel

Change `createInspectorPanel` to receive `dbState` and `sessionRef` in addition to `AppState`.

Render states:

- No DB or no selection: neutral empty state.
- Folder selection: folder detail state, no preview.
- Non-image file selection: file detail state with "no image preview available".
- Image file with valid bytes: object URL-backed image preview, constrained to panel bounds.
- Image file with missing/invalid bytes or image load error: preview-unavailable state.

Object URL lifecycle:

- Revoke previous object URL before rendering a new preview.
- Revoke current object URL when the panel is disposed, if the renderer lifecycle supports disposal; otherwise revoke before every replacement and on DB/selection reset.
- Do not retain copied binary data beyond the selected file reference.

### Image Recognition

Use a small helper that recognizes browser-previewable image assets from `DbFile.type`, `DbFile.format`, or extension in `DbFile.name`.

Supported target formats for v1:

- PNG
- JPEG/JPG
- GIF
- WebP
- BMP
- SVG

The helper should return a browser MIME type for object URL creation when known. Unsupported or ambiguous types produce the non-image or preview-unavailable state depending on whether the file was image-like.

### Validation

Automated tests should cover:

- AppState resource selection initial state, updates, and reset behavior.
- Image recognition for type/name combinations.
- Missing/empty bytes result classification if helper extraction makes this pure and testable.

Manual visual verification should cover:

- Selecting an image in Resources updates Inspector.
- Selecting a folder/non-image clears a previous preview.
- Large image stays inside Inspector bounds.
- Closing/reopening a project clears stale selection.

## Phase 0: Research Output

See [research.md](research.md).

## Phase 1: Design Output

See [data-model.md](data-model.md), [contracts/inspector-image-preview-contract.md](contracts/inspector-image-preview-contract.md), and [quickstart.md](quickstart.md).

## Post-Design Constitution Check

- **Static runtime preserved**: Pass. Contracts use only in-memory DB data and browser DOM/image primitives.
- **No-server path preserved**: Pass. No HTTP endpoint, worker service, or backend is required.
- **Real-time behavior protected**: Pass. State updates are synchronous and preview creation avoids manual image decoding.
- **File System Access compatibility addressed**: Pass. Feature does not broaden browser support or add direct file access.
- **Local engine contract defined**: Pass. No local engine messages are used.
- **Maintainability preserved**: Pass. State, image classification, Resources selection, and Inspector rendering are separable and testable.

**Result: All post-design gates pass. No violations.**

## Complexity Tracking

*No constitution violations; table not applicable.*
