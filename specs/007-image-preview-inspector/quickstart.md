# Quickstart: Image Preview in Inspector

**Feature**: 007-image-preview-inspector  
**Date**: 2026-05-05

## What This Feature Adds

Selecting an image file in the Resources file explorer updates the Inspector panel with a preview of that image. Selecting a folder, a non-image file, or nothing clears any previous preview and shows a current-selection state.

## How to Validate

1. Run the dev server: `npm run dev`
2. Open the app in a browser.
3. Open a project database containing image files in the `FILES` table.
4. In the Resources panel, expand folders until an image file is visible.
5. Select a PNG, JPEG, GIF, WebP, BMP, or SVG file.
6. Confirm the Inspector panel shows the selected file name and image preview.
7. Select a folder.
8. Confirm the previous image preview is cleared.
9. Select a non-image file.
10. Confirm Inspector shows that no image preview is available for that file.
11. Select a different image file.
12. Confirm the preview updates to the newly selected image.
13. Resize the Inspector panel.
14. Confirm the image stays inside the panel and preserves its aspect ratio.

## Multi-Project Validation

1. Open two project windows when multi-project support is available.
2. Select an image in the first project's Resources panel.
3. Select a different item in the second project's Resources panel.
4. Confirm each Inspector panel reflects only the selection from its own project window.

## Expected Code Changes

| File | Expected change |
|------|-----------------|
| `src/app/types.ts` | Add resource selection snapshot type if AppState owns the selection |
| `src/state/app-state.ts` | Store and publish current resource selection |
| `src/panels/resources-panel.ts` | Publish selected folder/file rows and selected-row UI state |
| `src/panels/inspector-panel.ts` | Resolve selected file and render image preview/fallback states |
| `src/panels/panel-registry.ts` | Pass DB dependencies into Inspector if needed |
| `src/styles/app.css` | Add selected resource and Inspector preview styles |
| `tests/unit/app-state.test.ts` | Cover selection update/reset behavior |
| `tests/unit/image-preview.test.ts` | Cover image recognition helper behavior if extracted |

## Required Checks

- `npm test`
- `npm run lint`
- `npm run build`
- Manual browser validation of Resources-to-Inspector preview behavior
