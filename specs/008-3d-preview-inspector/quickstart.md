# Quickstart: 3D Model Preview in Inspector

**Feature**: 008-3d-preview-inspector  
**Date**: 2026-05-05

## What This Feature Adds

Selecting a supported 3D model file in Resources shows a 3D preview in the Inspector panel. The preview is read-only, fits inside the panel, shows basic metadata including vertex count, and can be inspected with rotation, zoom, and pan. Unsupported model-like files show a clear preview-unavailable state.

Supported preview formats at close: `.glb`, `.gltf`, `.obj`, `.fbx`, `.dae`, `.3ds`, `.lwo`, and `.md2`.

Recognized fallback formats at close: `.md3`, `.lws`, and `.blend`.

## How to Validate

1. Install dependencies after implementation: `npm install`
2. Run the dev server: `npm run dev`
3. Open the app in a browser.
4. Open a project database containing a valid embedded `.glb` model file.
5. In Resources, select the `.glb` model file.
6. Confirm Inspector shows the file name, size, vertex count, and a visible 3D preview.
7. Drag inside the preview frame.
8. Confirm the model changes angle while staying inside the Inspector panel.
9. Use the mouse wheel over the preview frame.
10. Confirm the model zooms in/out within usable limits.
11. Hold Shift and drag inside the preview frame.
12. Confirm the model pans in the preview.
13. Select an image file.
14. Confirm the model preview is cleared and the existing image preview behavior appears.
15. Select a folder or non-previewable file.
16. Confirm the model preview is cleared and a non-preview state appears.
17. Select a fallback-first model-like file such as `.blend`.
18. Confirm Inspector shows preview-unavailable rather than a blank canvas.
19. Resize the Inspector panel.
20. Confirm the canvas remains contained and readable.

## Companion Resource Validation

1. Open a project containing a model with external resources already stored in the project database.
2. For OBJ, include its `.mtl` and texture image files.
3. For glTF, include external `.bin` and texture files if the file is not self-contained.
4. For MD2, include a JPG/JPEG/PNG/WEBP/BMP texture whose basename matches the MD2 skin reference or the model filename. Basic PCX skins are also supported.
5. Select the model and confirm the preview applies textures when matching resources are present.

## Required Checks

- `npm test`
- `npm run lint`
- `npm run build`
- Manual browser validation with at least one valid `.glb` file
- Manual browser validation for `.3ds`, `.lwo`, and `.md2` when sample assets are available

## Validation Notes

- Use a self-contained `.glb` for the first positive validation case.
- Use a recognized fallback format such as `.blend` to verify that unsupported model-like files show preview-unavailable instead of leaving a blank canvas.
- Ambient occlusion is intentionally not part of the final implementation because attempted SSAO/SAO pipelines caused black previews during validation.

## Expected Code Changes

| File | Expected change |
|------|-----------------|
| `package.json` | Add `three` runtime dependency |
| `src/panels/model-preview.ts` | Add model classification and previewability helper |
| `src/panels/model-viewer.ts` | Add Three.js viewer lifecycle and loader orchestration |
| `src/panels/inspector-panel.ts` | Integrate model preview states with existing image/fallback states |
| `src/styles/app.css` | Add model preview canvas/loading/fallback styles |
| `tests/unit/model-preview.test.ts` | Add model classification tests |
