# Research: 3D Model Preview in Inspector

**Feature**: 008-3d-preview-inspector  
**Phase**: 0 - Outline & Research  
**Date**: 2026-05-05

## Decision 1: Rendering Library

**Decision**: Use Three.js as the 3D rendering and loader dependency.  
**Rationale**: Three.js provides a browser-native WebGL renderer, scene/camera abstractions, and maintained loaders for common model formats. Building this manually would violate maintainability and delivery risk expectations.  
**Alternatives considered**: Hand-rolled WebGL renderer (too much complexity), local visuals engine rendering (violates the spec's no-engine core preview requirement), server-side conversion (violates static runtime).

## Decision 2: Previewable Format Set

**Decision**: Target `.glb`, `.gltf`, `.obj`, `.fbx`, `.dae`, `.3ds`, `.lwo`, and `.md2` for browser preview.  
**Rationale**: These formats map to maintained Three.js loaders available in the installed dependency: GLTFLoader, OBJLoader, FBXLoader, ColladaLoader, TDSLoader, LWOLoader, and MD2Loader. `.glb` remains the best first validation format because it can be self-contained. `.md2` requires wrapping parsed geometry in a preview mesh and resolving optional skin textures separately.  
**Alternatives considered**: Support every recognized extension immediately (too broad), GLB-only MVP (simpler but under-delivers against the spec), convert all models to glTF first (requires extra dependency/workflow).

## Decision 3: Recognized Fallback Formats

**Decision**: Recognize `.md3`, `.lws`, and `.blend` as model-like fallback formats. `.3ds`, `.lwo`, and `.md2` moved from fallback to previewable after loader validation.  
**Rationale**: The Resources panel classifies these as model assets, but reliable browser preview support varies. `.blend` is especially unsuitable for direct browser preview without conversion, and `.md3`/`.lws` remain fallback until a loader is added and validated.  
**Alternatives considered**: Hide these as unknown files (less helpful), attempt best-effort parsing without tested loaders (fragile), block the feature until all formats work (unnecessary).

## Decision 4: Data Source

**Decision**: Read model bytes from the selected `DbFile.data` in the current `DbSessionRef`.  
**Rationale**: The project database reader already loads file BLOB data into memory. This keeps preview logic inside the browser and respects project-window isolation.  
**Alternatives considered**: Direct filesystem reads (not available from embedded project assets), re-querying sql.js in the Inspector (breaks the UI data boundary), backend conversion (not allowed).

## Decision 5: Viewer Lifecycle

**Decision**: Isolate Three.js scene setup and disposal in a dedicated `model-viewer.ts` helper.  
**Rationale**: WebGL resources, animation frames, object URLs, loader state, and resize handling need explicit cleanup. Keeping that out of `inspector-panel.ts` protects readability.  
**Alternatives considered**: Inline all Three.js code in Inspector (harder to maintain), one global renderer (risks cross-project state leakage), no disposal until page unload (memory leak risk).

## Decision 6: Interaction Model

**Decision**: Provide direct canvas interactions: pointer-drag rotation, mouse-wheel zoom, and Shift-drag panning rather than adding orbit controls as another addon dependency.  
**Rationale**: The spec requires inspecting from more than one angle, and follow-up validation required zoom and pan. These interactions satisfy inspection needs with minimal code and no additional controls module.  
**Alternatives considered**: OrbitControls (richer, but more setup and touch/resize considerations), fixed auto-rotate only (less direct user control), no interaction (does not meet spec).

## Decision 7: External Resource and Texture Resolution

**Decision**: Resolve model companion assets from project database files through a Three.js `LoadingManager` URL modifier and local object URLs. For MD2 skins, parse the binary skin table and search referenced or basename-matched image assets, including JPG/JPEG/PNG/WEBP/BMP and basic 8-bit paletted PCX skins.
**Rationale**: Project model assets often reference sibling textures or material files. The browser preview has no direct filesystem access, so resources must come from already loaded project files. MD2 skins are not exposed by Three.js `MD2Loader`, so the viewer reads those names directly.
**Alternatives considered**: Only support embedded/self-contained models (too limiting), direct filesystem lookups (not available in static runtime), server-side conversion (violates no-backend constraint).

## Decision 8: Ambient Occlusion

**Decision**: Do not ship ambient occlusion in this spec.
**Rationale**: SSAO/SAO attempts caused selected assets to render nearly black in real validation. Legible preview is higher priority than contact-shadow styling. AO can be revisited later as an optional, tuned control.
**Alternatives considered**: Fixed SSAO or SAO pass (caused black previews), custom blended AO overlay (still failed real validation), per-material AO maps only (not broadly available).

## Resolved: No NEEDS CLARIFICATION Items

All planning unknowns are resolved:

- Core library: Three.js.
- Previewable formats: GLB/GLTF, OBJ, FBX, DAE, 3DS, LWO, MD2.
- Recognized fallback formats: MD3, LWS, BLEND.
- Data source: selected file bytes from current in-memory project database.
- Engine dependency: none for core preview.
