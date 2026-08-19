# Contract: CAM Persisted Asset Save

The feature reuses Phoenix's existing HTTP asset contract; it adds no endpoint.

## Request

`PUT /api/assets/file`

```json
{
  "requestId": "asset-<unique-id>",
  "path": "pool/cameras/example.cam",
  "encoding": "base64",
  "content": "<UTF-8 editor bytes encoded as base64>",
  "reloadSections": true
}
```

The request is made only for an enabled asset while Phoenix is connected. The normalized path must remain under `pool` or `resources`.

## Successful Response

```json
{
  "requestId": "asset-<unique-id>",
  "ok": true,
  "operation": "write-file",
  "path": "pool/cameras/example.cam",
  "persisted": true,
  "reloadedSections": [{ "id": "17", "type": "cameraTarget" }],
  "deactivatedSections": [],
  "failedSections": []
}
```

Phoenix attempts every indexed section for the exact asset path independently. Cacablu clears resolved asset errors for `reloadedSections`, and marks/reports every entry in `failedSections` or `deactivatedSections`.

## Degraded Behavior

- Disabled asset: no request.
- Disconnected Phoenix: local save succeeds and Cacablu adds one warning Event.
- HTTP/network failure after local persistence: local save remains committed and Cacablu adds an error Event.
- Partial dependent reload failure: the response remains usable; successful and unsuccessful section results are applied independently.
