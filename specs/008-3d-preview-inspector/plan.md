# Implementation Plan: 3D Model Preview in Inspector

**Branch**: `008-3d-preview-inspector` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/008-3d-preview-inspector/spec.md`

## Summary

Extend the existing Resources-to-Inspector preview pipeline so selected 3D model files render inside the Inspector panel. Add Three.js as the browser rendering dependency, classify model assets from file metadata, and add a dedicated model preview renderer that owns WebGL scene setup, loader selection, companion resource resolution, interaction, resize handling, and disposal. The implementation preserves the existing image preview behavior, shows vertex count metadata, and shows explicit fallback states for recognized-but-unpreviewable or invalid model files.

## Technical Context

**Language/Version**: TypeScript 5.x, browser target ES2020+  
**Primary Dependencies**: `dockview-core` ^5.2.0, `sql.js` ^1.14.1, new `three` runtime dependency for WebGL preview and loaders  
**Storage**: In-memory `ProjectDatabase` exposed through `DbSessionRef`; no direct SQLite queries in preview code  
**Testing**: Vitest for model classification and state logic; `npm test`, `npm run lint`, `npm run build`; manual visual validation required  
**Target Platform**: Browser static app, primarily Chrome/Edge-class browsers with WebGL and File System Access API support  
**Project Type**: Browser-only static web application  
**Performance Goals**: Preview appears in under 2 seconds for typical embedded models; selection changes and fallback states remain immediate  
**Constraints**: No backend, no server dependency, no local engine dependency, read-only preview, all object URLs/WebGL resources must be disposed when replaced or destroyed  
**Scale/Scope**: Existing Resources selection and Inspector panel, one new model preview helper/renderer, focused tests, one new runtime dependency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Static runtime preserved**: Pass. Three.js runs entirely in the browser and loads model bytes from in-memory project data.
- **No-server path preserved**: Pass. The preview uses local object URLs/data already loaded from the project database; no API or backend is introduced.
- **Real-time behavior protected**: Pass with constraint. Typical models are loaded asynchronously through browser/Three.js primitives; invalid/unsupported models must fail fast to fallback states. Very large models may be fallbacked if they threaten responsiveness.
- **File System Access compatibility addressed**: Pass. This feature does not call File System Access APIs directly; it depends on the existing project-open workflow.
- **Local engine contract defined**: Pass. No WebSocket messages or local visuals engine behavior are used.
- **Maintainability preserved**: Pass. Model classification, loader selection, renderer lifecycle, and Inspector state remain separate and testable.
- **Dependency policy**: Pass. Three.js is open source and widely maintained; it is justified because 3D rendering/loaders would otherwise be hand-rolled.

**Result: All gates pass. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/008-3d-preview-inspector/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- inspector-3d-preview-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (expected change surface)

```text
package.json                 # Add three dependency
package-lock.json            # Updated by npm install

src/
|-- panels/
|   |-- model-preview.ts      # New model detection + loader target metadata
|   |-- model-viewer.ts       # New Three.js renderer/lifecycle helper
|   |-- inspector-panel.ts    # Integrate model preview before generic non-image fallback
|   |-- image-preview.ts      # Existing image preview helper; unchanged except coordination if needed
|   `-- resources-panel.ts    # Existing model icon detection already recognizes common model extensions
`-- styles/
    `-- app.css               # Inspector 3D preview frame/loading/fallback styles

tests/
`-- unit/
    |-- model-preview.test.ts # New model classification tests
    `-- image-preview.test.ts # Existing image tests should remain passing
```

**Structure Decision**: Single browser app layout. Add one dependency and keep all feature logic in the existing panel layer. No backend, worker service, or separate package is required for v1.

## Implementation Design

### Format Tiers

Previewable target formats for v1:

- `.glb` / `.gltf` via Three.js GLTFLoader
- `.obj` via Three.js OBJLoader
- `.fbx` via Three.js FBXLoader
- `.dae` via Three.js ColladaLoader
- `.3ds` via Three.js TDSLoader
- `.lwo` via Three.js LWOLoader
- `.md2` via Three.js MD2Loader with preview mesh material and optional skin texture resolution

Recognized but fallback-first formats:

- `.md3`
- `.lws`
- `.blend`

Fallback-first means the Inspector identifies the file as model-like but displays a clear preview-unavailable state unless implementation later adds and validates a loader.

### Inspector Integration

The Inspector should classify the selected file in this order:

1. No DB / no selection / folder selection states.
2. Image preview behavior already implemented by `image-preview.ts`.
3. Model preview behavior from `model-preview.ts`.
4. Generic non-preview file fallback.

Model preview selection must clear any existing image object URL and any existing WebGL renderer/model scene.

### Three.js Viewer Lifecycle

`model-viewer.ts` owns:

- Creating scene, camera, renderer, lights, and model root.
- Loading selected model bytes through the appropriate loader.
- Creating and revoking object URLs for loaders that consume URLs.
- Fitting model bounds to camera and panel frame.
- Basic pointer drag rotation or orbit-style inspection.
- Resize handling scoped to the Inspector preview frame.
- Disposal of renderer, geometries, materials, textures, object URLs, and animation frame callbacks.

### External Asset Handling

- `.glb` is the preferred embedded format because model and resources can be self-contained.
- `.gltf` is previewable when self-contained or when dependencies can be resolved from project files already loaded in the database.
- `.obj`, `.dae`, `.fbx`, `.3ds`, and `.lwo` can preview geometry from the selected file bytes when the loader accepts content; companion materials/textures are resolved from project files where possible.
- `.md2` can preview geometry and attempts to apply skin textures referenced by the binary or matching the model basename, including JPG/JPEG/PNG/WEBP/BMP and basic PCX.
- Missing external companion files must not produce broken UI; the fallback state should name the issue where possible.

### Validation

Automated tests should cover:

- Model extension/type/format classification.
- Previewable vs recognized-fallback model descriptor behavior.
- Empty bytes and unsupported model-like metadata.

Manual validation should cover:

- Valid `.glb` preview appears in Inspector.
- Drag/interaction changes the model angle.
- Mouse-wheel zoom and Shift-drag pan work in the preview.
- Selecting image/folder/non-model clears the 3D preview.
- Invalid or fallback-first formats show preview-unavailable.
- Resize keeps canvas inside Inspector bounds.

## Phase 0: Research Output

See [research.md](research.md).

## Phase 1: Design Output

See [data-model.md](data-model.md), [contracts/inspector-3d-preview-contract.md](contracts/inspector-3d-preview-contract.md), and [quickstart.md](quickstart.md).

## Post-Design Constitution Check

- **Static runtime preserved**: Pass. The design uses a browser runtime dependency and embedded project bytes only.
- **No-server path preserved**: Pass. No backend is required for core preview.
- **Real-time behavior protected**: Pass with explicit disposal/fallback rules for large or invalid models.
- **File System Access compatibility addressed**: Pass. Existing DB-open browser requirement remains unchanged.
- **Local engine contract defined**: Pass. No engine messages are used.
- **Maintainability preserved**: Pass. Renderer lifecycle and model classification are isolated from Inspector orchestration.
- **Dependency policy**: Pass. Three.js is the only new runtime dependency and is justified by the 3D rendering requirement.

**Result: All post-design gates pass. No violations.**

## Complexity Tracking

*No constitution violations; table not applicable.*
