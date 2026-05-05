# Data Model: Image Preview in Inspector

**Feature**: 007-image-preview-inspector  
**Phase**: 1 - Design  
**Date**: 2026-05-05

## Source Entities

These entities already exist in `src/db/db-schema.ts` and are populated by `src/db/db-reader.ts`.

### DbFile

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique file identifier used by Resources selection and Inspector lookup |
| `name` | string | Display name and extension source for image recognition |
| `parent` | number | Parent folder id used by Resources tree |
| `bytes` | number | Stored byte count, useful for detail display |
| `type` | string | Stored MIME/category hint used for image recognition |
| `data` | `Uint8Array` | Raw file bytes used to create the preview Blob |
| `format` | string | Optional format hint used for image recognition |
| `enabled` | boolean | Existing project flag; preview remains read-only |

### DbFolder

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique folder identifier used by Resources selection |
| `name` | string | Display name for selected folder state |
| `parent` | number | Parent folder id used by Resources tree |
| `enabled` | boolean | Existing project flag; preview feature does not mutate it |

## UI State Entities

### ResourceSelection

Project-window scoped UI selection owned by the shared state instance.

| Variant | Fields | Description |
|---------|--------|-------------|
| `none` | none | No current Resources selection |
| `folder` | `id`, `name` | A folder row is selected; Inspector shows folder/non-preview state |
| `file` | `id`, `name`, `fileType` | A file row is selected; Inspector resolves the matching `DbFile` |

Validation rules:

- Only one resource can be selected at a time.
- Selection resets to `none` when the DB is cleared or a new DB begins opening.
- File selection ids must be resolved against the current `ProjectDatabase.files` before previewing.
- If the selected file id no longer exists, Inspector treats the state as preview unavailable and must not show stale content.

### ImagePreviewDescriptor

Derived, non-persisted classification for a selected `DbFile`.

| Field | Type | Description |
|-------|------|-------------|
| `isImageLike` | boolean | Whether file metadata suggests image preview is relevant |
| `mimeType` | string or null | Browser MIME type to use for `Blob` creation when known |
| `reason` | string or null | Optional fallback reason for empty/invalid/unsupported content |

Validation rules:

- Previewable formats for v1: PNG, JPEG/JPG, GIF, WebP, BMP, SVG.
- Empty `data` always prevents preview.
- Unknown image-like metadata may produce preview-unavailable instead of attempting unsafe assumptions.

### InspectorPreviewState

Render state derived from `ResourceSelection`, `DbState`, and `DbSessionRef`.

| State | Trigger | Inspector behavior |
|-------|---------|--------------------|
| `empty` | No DB or `ResourceSelection.none` | Show neutral empty state |
| `folder` | Folder selected | Show folder name/details; no image |
| `nonImageFile` | File selected but not image-like | Show file name/details and no-preview message |
| `imagePreview` | Image-like file with non-empty bytes and valid object URL | Show constrained image preview |
| `previewUnavailable` | Image-like file missing, empty, invalid, unsupported, or load error | Show clear fallback state |

## State Transitions

```text
Initial app state
  -> ResourceSelection.none
  -> InspectorPreviewState.empty

DB opening/cleared
  -> reset ResourceSelection.none
  -> revoke current object URL
  -> InspectorPreviewState.empty

User selects folder in Resources
  -> ResourceSelection.folder
  -> revoke current object URL
  -> InspectorPreviewState.folder

User selects non-image file in Resources
  -> ResourceSelection.file
  -> revoke current object URL
  -> InspectorPreviewState.nonImageFile

User selects previewable image file in Resources
  -> ResourceSelection.file
  -> resolve DbFile by id
  -> create Blob + object URL
  -> InspectorPreviewState.imagePreview

Image load fails
  -> revoke failed object URL
  -> InspectorPreviewState.previewUnavailable
```

## Persistence

No new persisted data is introduced. Selection and preview state are UI-only and discarded when the project window closes or the application reloads.
