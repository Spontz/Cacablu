# Contract: Inspector Image Preview

**Feature**: 007-image-preview-inspector  
**Contract Type**: Internal UI panel/state contract  
**Date**: 2026-05-05

## Participants

| Participant | Responsibility |
|-------------|----------------|
| Resources panel | Publishes the current folder/file selection for its project window |
| AppState | Stores the current `ResourceSelection` and notifies subscribers |
| Inspector panel | Subscribes to selection and DB state, resolves selected files, renders preview/fallback |
| DbSessionRef | Provides read-only access to `ProjectDatabase.files` and `.folders` |

## Selection Contract

`AppState` MUST expose:

```typescript
type ResourceSelection =
  | { kind: 'none' }
  | { kind: 'folder'; id: number; name: string }
  | { kind: 'file'; id: number; name: string; fileType: string };

setResourceSelection(selection: ResourceSelection): void;
clearResourceSelection(): void;
```

`AppSnapshot` MUST include:

```typescript
resourceSelection: ResourceSelection;
```

Publishing rules:

- Resources publishes a folder selection when a folder row is selected.
- Resources publishes a file selection when a file row is selected.
- DB open/clear transitions reset selection to `none`.
- Selection changes notify Inspector through the normal AppState subscription.

## Resources Panel Contract

The Resources panel MUST:

- Preserve existing folder expand/collapse behavior.
- Make file rows clickable/selectable.
- Publish a selection with stable id, display name, and file type.
- Apply a selected visual state to the currently selected row.
- Never mutate `ProjectDatabase`, `DbFile`, or `DbFolder`.

## Inspector Panel Contract

The Inspector panel factory MUST receive:

| Parameter | Type | Purpose |
|-----------|------|---------|
| `state` | `AppState` | Subscribe to resource selection |
| `dbState` | `DbState` | Clear/re-render on database lifecycle changes |
| `sessionRef` | `DbSessionRef` | Resolve selected files and read image bytes |

Render behavior:

| Input state | Required output |
|-------------|-----------------|
| No open DB | Empty state; no preview |
| Selection `none` | Empty selection state; no preview |
| Folder selected | Folder detail/non-preview state |
| Non-image file selected | File detail and no image preview message |
| Image file with bytes | Image preview plus selected file name |
| Image-like file missing/invalid bytes | Preview-unavailable state |
| Image load error | Revoke URL and show preview-unavailable state |

## Image Preview Contract

Supported v1 formats:

| Format | Recognized extensions | MIME type |
|--------|-----------------------|-----------|
| PNG | `.png` | `image/png` |
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` |
| GIF | `.gif` | `image/gif` |
| WebP | `.webp` | `image/webp` |
| BMP | `.bmp` | `image/bmp` |
| SVG | `.svg` | `image/svg+xml` |

The implementation MAY also use stored `DbFile.type` or `DbFile.format` to recognize these same formats when file names are incomplete.

## Object URL Lifecycle Contract

Inspector MUST:

- Revoke the current object URL before creating a replacement.
- Revoke the current object URL when selection becomes non-image, empty, or unavailable.
- Revoke the current object URL when the renderer is disposed if disposal is available.
- Not store object URLs in global state.

## Non-Goals

- No image editing.
- No asset rename/delete/move.
- No thumbnail cache.
- No direct File System Access API calls.
- No local engine or WebSocket messages.
- No support for specialized image formats requiring custom decoders in v1.
