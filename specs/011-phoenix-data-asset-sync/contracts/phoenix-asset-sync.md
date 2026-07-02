# Contract: Phoenix Asset Sync

This contract describes the Cacablu client expectations for the paired Phoenix asset sync API.

## HTTP Base

Default local base URL:

```text
http://127.0.0.1:29100
```

The WebSocket endpoint remains:

```text
ws://127.0.0.1:29100/ws
```

## Manifest

### GET /api/assets/manifest

Cacablu requests Phoenix's active engine asset manifest.

Response:

```json
{
  "root": "phoenix-engine",
  "generatedAt": "",
  "entries": [
    {
      "path": "pool/shaders/basic/example.glsl",
      "kind": "file",
      "size": 1234,
      "hash": "fnv1a:..."
    },
    {
      "path": "resources/textures",
      "kind": "directory"
    }
  ]
}
```

Client behavior:

- Accept only entries under `pool` and `resources`.
- Treat malformed entries as manifest errors.
- Compare initial published pool sync by normalized `path` and `size`.

## Asset Operations

### PUT /api/assets/file

Writes or replaces one file under Phoenix `data/pool` or `data/resources`.

Request:

```json
{
  "requestId": "client-generated-id",
  "path": "pool/shaders/basic/example.glsl",
  "encoding": "base64",
  "content": "..."
}
```

Response:

```json
{
  "requestId": "client-generated-id",
  "ok": true,
  "operation": "write-file",
  "entry": {
    "path": "pool/shaders/basic/example.glsl",
    "kind": "file",
    "size": 1234,
    "hash": "fnv1a:..."
  }
}
```

### POST /api/assets/directory

Creates one directory under Phoenix `data/pool` or `data/resources`.

Request:

```json
{
  "requestId": "client-generated-id",
  "path": "resources/textures/generated"
}
```

### DELETE /api/assets/file

Deletes one file under Phoenix `data/pool` or `data/resources`.

Request:

```json
{
  "requestId": "client-generated-id",
  "path": "pool/shaders/basic/example.glsl"
}
```

### DELETE /api/assets/directory

Deletes one directory under Phoenix `data/pool` or `data/resources`.

Request:

```json
{
  "requestId": "client-generated-id",
  "path": "resources/textures/generated",
  "recursive": true
}
```

## Sections

### GET /api/sections/manifest

Cacablu requests Phoenix's current runtime section manifest.

Response:

```json
{
  "root": "phoenix-sections",
  "generatedAt": "",
  "sections": [
    {
      "id": "42",
      "type": "drawImage",
      "start": 0,
      "end": 5,
      "enabled": true,
      "layer": 1,
      "blend": ["GL_SRC_ALPHA", "GL_ONE_MINUS_SRC_ALPHA"],
      "blendequation": "GL_FUNC_ADD",
      "scriptHash": "fnv1a:...",
      "script": "optional canonical script text"
    }
  ]
}
```

Client behavior:

- Compare the response against the serialized project bar snapshot.
- Treat missing, extra, or field-mismatched sections as a non-exact match.
- Skip section replacement only when every canonical section entry matches.

### PUT /api/sections

Replaces Phoenix's runtime section set with the sections serialized from the loaded project bars.

Request:

```json
{
  "requestId": "client-generated-id",
  "mode": "replace-all",
  "sections": [
    {
      "id": 42,
      "type": "drawImage",
      "start": 0,
      "end": 5,
      "enabled": true,
      "layer": 1,
      "blend": ["GL_SRC_ALPHA", "GL_ONE_MINUS_SRC_ALPHA"],
      "blendequation": "GL_FUNC_ADD",
      "script": "texture pool/images/logo.png"
    }
  ]
}
```

Response:

```json
{
  "requestId": "client-generated-id",
  "ok": true,
  "operation": "replace-sections",
  "sectionCount": 1,
  "writtenFiles": ["17.spo"],
  "deletedFiles": ["9.spo"]
}
```

Client behavior:

- Send this only after the initial pool sync has completed or been skipped.
- Send this only when Phoenix's section manifest differs from the serialized project bars.
- Include all project bars in one request, not only changed bars.
- Treat request failure as project-open sync failure and leave the project unloaded.
- Expect Phoenix to write one `.spo` file directly under its active `data` folder for each received section.
- Expect persisted filenames to be `<id>.spo`, for example `17.spo`.
- Expect Phoenix to delete root `<id>.spo` files for sections that are removed during replacement.
- Expect persisted file content to match the canonical section format:

```text
:::<type>
id <id>
start <start>
end <end>
enabled <0-or-1>
layer <layer>
blend <srcBlending> <dstBlending>
blendequation <blendingEQ>

<raw section script>
```

## WebSocket Events

### asset.changed

Phoenix may emit this after a successful asset mutation in a future extension. Cacablu must not require this event for the HTTP operation to be considered complete.

```json
{
  "type": "asset.changed",
  "requestId": "client-generated-id",
  "operation": "write-file",
  "path": "pool/shaders/basic/example.glsl",
  "entry": {
    "path": "pool/shaders/basic/example.glsl",
    "kind": "file",
    "size": 1234,
    "hash": "fnv1a:..."
  }
}
```

### error

Phoenix may return or emit structured errors.

```json
{
  "type": "error",
  "requestId": "client-generated-id",
  "code": "path-out-of-scope",
  "message": "Only pool and resources paths are allowed"
}
```

Client behavior:

- Correlate `requestId` when available.
- Keep Cacablu usable after errors.
- Refresh discrepancy state after rejected or failed operations where possible.

### section.changed

Phoenix may emit this after successful section replacement.

```json
{
  "type": "section.changed",
  "requestId": "client-generated-id",
  "operation": "replace-sections",
  "sectionCount": 12,
  "writtenFiles": ["17.spo", "18.spo"],
  "deletedFiles": ["9.spo"]
}
```

## Client-Side Send Rules

- Cacablu sends no asset manifest comparison or mutation until a project is loaded.
- Cacablu does not ask the user to select Phoenix's destination `data` folder.
- On project open, Cacablu treats enabled database pool files as the expected Phoenix `pool` file set.
- If Phoenix pool is not an exact path/size match, Cacablu deletes Phoenix `pool`, recreates it, and uploads all enabled pool files.
- On project open, Cacablu serializes database bars as Phoenix sections after the initial pool sync completes or is skipped.
- If Phoenix sections are an exact match, Cacablu sends no section replacement.
- If Phoenix sections differ, Cacablu sends one full `replace-all` section request containing every project bar.
- Cacablu sends no operation for `config`.
- Cacablu sends no absolute path.
- Cacablu sends no path containing traversal after normalization.
- Cacablu sends only paths whose first segment is `pool` or `resources`.
