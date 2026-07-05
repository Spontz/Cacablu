# Contract: GLSL Asset Editor Hot Reload

## Preview Asset

`PUT /api/assets/preview`

Request:

```json
{
  "requestId": "asset-preview-123",
  "path": "pool/shaders/example.glsl",
  "encoding": "utf-8",
  "content": "void main() {}"
}
```

Successful response:

```json
{
  "requestId": "asset-preview-123",
  "ok": true,
  "operation": "preview-asset",
  "path": "pool/shaders/example.glsl",
  "persisted": false,
  "reloadedSections": [{ "id": 17, "type": "efxBloom" }],
  "deactivatedSections": [],
  "failedSections": []
}
```

Failed response:

```json
{
  "requestId": "asset-preview-123",
  "ok": false,
  "code": "section-reload-failed",
  "message": "One or more dependent sections failed to reload.",
  "reloadedSections": [],
  "deactivatedSections": [],
  "failedSections": [{ "id": 17, "type": "efxBloom", "message": "Shader compile failed." }]
}
```

## Persisted Asset Write

Existing persisted asset write requests keep their current payload and receive the same impact fields in the response. `persisted` must be `true` when Phoenix writes the file to disk.

## Asset Delete, Unpublish, And Move

Existing asset lifecycle requests receive the same impact fields. Dependent sections that can no longer resolve the asset appear in `deactivatedSections`.
