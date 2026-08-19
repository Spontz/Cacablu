# Data Model: CAM Text Editor With Column Highlighting

## CAM Asset

Existing `DbFile` row selected by immutable numeric `id`.

- `id`: editor identity and stale-target guard.
- `name`: case-insensitive `.cam` eligibility and display name.
- `parent`: source for normalized Pool path resolution.
- `data`: UTF-8 bytes persisted by Save.
- `bytes`: encoded byte length.
- `type`: `text/plain` after Save.
- `format`: `cam` after Save.
- `enabled`: controls whether Save/Undo synchronizes the asset to Phoenix.

## CAM Draft

Panel-local state held by Monaco.

- `currentFileId`: asset identity bound to the panel.
- `currentPath`: current normalized `pool/...` destination.
- `originalContent`: last locally persisted text used to derive Save availability.
- `editorContent`: current unsaved text.
- `saveInFlight`: prevents overlapping Save operations.

## Column Token

Pure decoration input derived from current text.

- `lineNumber`: one-based Monaco line number.
- `startColumn`: one-based inclusive start.
- `endColumn`: one-based exclusive end.
- `columnIndex`: zero-based token position within that line.

Whitespace is not an entity and is never decorated or normalized.

## Save Transition

1. Resolve the file by `currentFileId`; reject a missing or non-CAM target.
2. Snapshot its previous content fields.
3. UTF-8 encode the complete draft and update the same `DbFile`.
4. Mark project dirty and register one Undo action.
5. If `enabled && connected`, perform one persisted Phoenix write and apply asset-impact results.
6. If `enabled && disconnected`, add one warning.
7. If disabled, stop after local persistence without a Phoenix request.

## Undo Transition

1. Confirm the original project session remains active and the file identity still exists.
2. Restore the exact snapshot fields and mark the project dirty.
3. Apply the same enabled/connected synchronization policy to the restored file.
