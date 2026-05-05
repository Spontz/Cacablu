# Research: Image Preview in Inspector

**Feature**: 007-image-preview-inspector  
**Phase**: 0 - Outline & Research  
**Date**: 2026-05-05

## Decision 1: Cross-Panel Selection State

**Decision**: Add resource selection to the existing app state shared by panels in one project window.  
**Rationale**: Resources and Inspector already receive `AppState` through `panel-registry.ts`, and the app currently uses state subscriptions for cross-panel updates such as active panel display. This keeps selection scoped to the project-window shell instance and avoids a new global event bus.  
**Alternatives considered**: DOM custom events between panels (harder to test and less explicit), putting selection inside Resources only (Inspector cannot subscribe cleanly), storing selection in `DbState` (DB state represents open/save lifecycle, not UI selection).

## Decision 2: Image Bytes Source

**Decision**: Read selected image bytes from `sessionRef.current.data.files`, using the selected file id to find the `DbFile`.  
**Rationale**: `db-reader.ts` already reads `FILES.data` into `DbFile.data: Uint8Array`, so the browser has the image data without additional SQLite queries or file system access. This follows the existing in-memory `ProjectDatabase` boundary.  
**Alternatives considered**: Re-querying sql.js from Inspector (duplicates reader responsibility), reading from original filesystem path (not available and breaks static browser model), caching thumbnails in state (premature for expected project sizes).

## Decision 3: Preview Rendering Mechanism

**Decision**: Create a `Blob` from `DbFile.data`, create an object URL, and render it in a browser `<img>` element.  
**Rationale**: Browser-native image decoding covers PNG, JPEG, GIF, WebP, BMP, and SVG without new dependencies. Object URLs avoid base64 conversion overhead and are easy to revoke when the selection changes.  
**Alternatives considered**: Data URLs (extra memory and conversion work), canvas decoding (unnecessary and less suitable for animated GIF/SVG), third-party image libraries (new dependency not justified).

## Decision 4: Image Type Detection

**Decision**: Classify previewable images from stored `type`, `format`, and file extension, returning a known browser MIME type when possible.  
**Rationale**: Existing Resources icons already infer asset class from extension, while the DB also stores `type` and `format`. Combining these signals improves resilience when one field is missing or generic.  
**Alternatives considered**: Extension-only detection (misses type-rich files with weak names), MIME-only detection (project files may store custom type labels), byte-signature sniffing (adds complexity and is unnecessary for v1).

## Decision 5: Fallback States

**Decision**: Inspector explicitly renders separate states for empty selection, folder selection, non-image file selection, and preview-unavailable image selection.  
**Rationale**: The spec requires stale previews to clear every time the current selection is not previewable. Separate states make manual validation straightforward and keep the UI honest.  
**Alternatives considered**: Leaving previous preview until next valid image (misleading), showing only a blank panel (ambiguous), alert dialogs for invalid images (interruptive and not useful for browsing).

## Decision 6: Object URL Lifecycle

**Decision**: Revoke the previous preview object URL before rendering a new one and when the renderer is disposed or reset.  
**Rationale**: Users may browse many files in one session; object URLs that are not revoked retain memory unnecessarily. The cleanup rule is local to Inspector and keeps memory behavior predictable.  
**Alternatives considered**: Letting browser cleanup on page close (works eventually but poor long-session behavior), caching every URL per file (unnecessary without repeated heavy conversion).

## Resolved: No NEEDS CLARIFICATION Items

All planning unknowns are resolved from the current codebase:

- `DbFile.data` is already available from `src/db/db-reader.ts`.
- Resources and Inspector share the same state instance through `src/panels/panel-registry.ts`.
- The feature has no local engine dependency and no File System Access API call beyond the existing DB-open workflow.
- Existing project size assumptions allow direct in-memory preview for v1.
