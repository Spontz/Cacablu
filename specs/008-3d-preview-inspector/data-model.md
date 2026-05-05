# Data Model: 3D Model Preview in Inspector

**Feature**: 008-3d-preview-inspector  
**Phase**: 1 - Design  
**Date**: 2026-05-05

## Source Entities

### DbFile

Already defined in `src/db/db-schema.ts` and populated by `src/db/db-reader.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique file identifier selected from Resources |
| `name` | string | Display name and extension source for model recognition |
| `type` | string | Stored MIME/category hint used for model recognition |
| `format` | string | Optional format hint used for model recognition |
| `bytes` | number | Stored byte count, useful for Inspector metadata and large-file decisions |
| `data` | `Uint8Array` | Raw model bytes used for preview loading |

## UI-Derived Entities

### ModelPreviewDescriptor

Derived classification for a selected file.

| Field | Type | Description |
|-------|------|-------------|
| `isModelLike` | boolean | Whether file metadata suggests the file is a 3D model |
| `format` | string or null | Normalized model format such as `glb`, `gltf`, `obj`, `fbx`, `dae`, `3ds`, `lwo`, or `md2` |
| `previewMode` | `previewable` or `fallback` or `none` | Whether v1 should attempt preview or show fallback |
| `reason` | string or null | User-facing reason when preview is unavailable |

Validation rules:

- Empty `data` prevents preview.
- `.glb`, `.gltf`, `.obj`, `.fbx`, `.dae`, `.3ds`, `.lwo`, and `.md2` are previewable targets.
- `.md3`, `.lws`, and `.blend` are model-like fallback targets.
- Unknown non-model files must not trigger 3D preview.

### ModelViewerSession

Runtime-only object owned by the Inspector while a model preview is visible.

| Field | Type | Description |
|-------|------|-------------|
| `container` | HTMLElement | Inspector frame that owns the canvas |
| `format` | string | Loader format for the current model |
| `fileName` | string | Selected file name for labels and error context |
| `files` | DbFile[] | Project files used to resolve companion buffers, material files, and textures |
| `onStats` | function | Optional callback used to report loaded model statistics such as vertex count |
| `dispose` | function | Releases renderer, model resources, events, URLs, and animation frame |

### InspectorPreviewState

Extends the current Inspector states from image preview work.

| State | Trigger | Inspector behavior |
|-------|---------|--------------------|
| `empty` | No DB or no selection | Show neutral state |
| `folder` | Folder selected | Show folder/non-preview state |
| `imagePreview` | Image file selected | Preserve existing image preview behavior |
| `modelLoading` | Previewable model selected | Show loading state and create viewer |
| `modelPreview` | Model loaded | Show canvas preview and file metadata |
| `modelUnavailable` | Model-like fallback/invalid/missing | Show preview-unavailable state |
| `nonPreviewFile` | Other file selected | Show generic no-preview state |

## State Transitions

```text
User selects previewable model
  -> classify ModelPreviewDescriptor.previewable
  -> dispose previous image/model resources
  -> render loading state
  -> create ModelViewerSession
  -> modelPreview or modelUnavailable

User selects image/folder/non-model
  -> dispose ModelViewerSession
  -> render appropriate existing Inspector state

Model load fails
  -> dispose partial ModelViewerSession
  -> modelUnavailable

Inspector disposed or DB changes
  -> dispose ModelViewerSession
  -> clear object URLs/resources
```

## Persistence

No new persisted data is introduced. Model preview state is UI-only and is discarded when selection changes, the project window closes, or the app reloads.
