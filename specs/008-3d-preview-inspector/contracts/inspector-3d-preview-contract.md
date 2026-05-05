# Contract: Inspector 3D Model Preview

**Feature**: 008-3d-preview-inspector  
**Contract Type**: Internal UI panel/rendering contract  
**Date**: 2026-05-05

## Participants

| Participant | Responsibility |
|-------------|----------------|
| Resources panel | Publishes selected file/folder through existing resource selection |
| Inspector panel | Chooses image, model, folder, or generic fallback state for current selection |
| Model preview helper | Classifies model-like files and previewability |
| Model viewer | Owns Three.js renderer, loaders, interaction, resize, and disposal |
| DbSessionRef | Provides selected file bytes from current project only |

## Supported Format Contract

| Extension | v1 behavior | Loader target |
|-----------|-------------|---------------|
| `.glb` | Previewable | GLTFLoader |
| `.gltf` | Previewable when self-contained or resolvable | GLTFLoader |
| `.obj` | Previewable geometry | OBJLoader |
| `.fbx` | Previewable when loader accepts content | FBXLoader |
| `.dae` | Previewable when loader accepts content | ColladaLoader |
| `.3ds` | Previewable when loader accepts content | TDSLoader |
| `.md2` | Previewable geometry with optional skin texture resolution | MD2Loader + preview mesh |
| `.md3` | Recognized fallback | None in v1 |
| `.lwo` | Previewable when loader accepts content | LWOLoader |
| `.lws` | Recognized fallback | None in v1 |
| `.blend` | Recognized fallback | None in v1 |

## Inspector Contract

The Inspector MUST:

- Preserve existing image preview behavior for image selections.
- Attempt model preview only when the selected file is model-like and previewable.
- Dispose any previous model viewer before rendering any new Inspector state.
- Dispose any previous image object URL before rendering a model preview.
- Show selected file name, size, and loaded vertex count with model preview or fallback.
- Show preview-unavailable for fallback-first, empty, invalid, externally incomplete, or failed models.
- Keep all preview behavior scoped to the current `DbSessionRef`.

## Model Viewer Contract

The model viewer MUST expose a lifecycle boundary equivalent to:

```typescript
interface ModelViewerSession {
  dispose(): void;
}
```

Creation input:

```typescript
interface ModelViewerInput {
  container: HTMLElement;
  fileName: string;
  fileParent: number;
  format: 'glb' | 'gltf' | 'obj' | 'fbx' | 'dae' | '3ds' | 'lwo' | 'md2';
  data: Uint8Array;
  files: DbFile[];
  onStats?(stats: { vertices: number }): void;
  onError(message: string): void;
}
```

Required behavior:

- Add exactly one rendering surface inside the supplied container.
- Fit the loaded model to the camera after load.
- Provide pointer drag rotation, mouse-wheel zoom, and Shift-drag panning.
- Resize with the container bounds.
- Dispose geometries, materials, textures, renderer, event listeners, animation frame, and object URLs.
- Resolve companion resources from project files where possible, including MTL/textures, glTF resources, and MD2 skin textures.

## Fallback Contract

Fallback UI MUST be shown when:

- File is model-like but format is not previewable in v1.
- File bytes are empty.
- Loader throws or reports an error.
- Model requires unavailable external companion files.
- Model complexity prevents responsive preview.

The fallback MUST replace the previous preview and MUST NOT leave a stale canvas visible.

## Non-Goals

- No model editing.
- No asset rename/delete/move.
- No conversion pipeline.
- No backend or local engine rendering.
- No ambient occlusion in this spec; previous attempts were removed because they caused black previews in validation.
- No guaranteed support for proprietary or companion-file-heavy formats beyond the project-file resource resolver.
