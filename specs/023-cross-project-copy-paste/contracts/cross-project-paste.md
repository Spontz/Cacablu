# Contract: Cross-Project Clipboard And Phoenix Reconciliation

## Clipboard Contract

### Custom format

`application/x-cacablu+json`

The value is UTF-8 JSON matching `CacabluClipboardEnvelope`.

### HTML fallback

`text/html` contains a Cacablu-owned marker with the same JSON encoded as base64. Decoders accept only the exact marker and validate the decoded envelope normally.

### Plain-text fallback

- Pool payload: one normalized `/pool/...` root path per line.
- Bar payload: non-executable summary identifying the copied bar count/ids.

Plain text alone MUST NOT be interpreted as structured project data.

## Cross-Editor Drag Contract

- A Pool drag publishes a versioned Cacablu Pool envelope through `DataTransfer`
  together with origin-instance metadata.
- The structured payload is self-contained and uses the same recursive nodes,
  binary bounds, path normalization, and shape validation as Pool Copy.
- A destination in the same editor routes to the existing move operation and
  preserves ids. A destination in another editor routes to atomic copy, assigns
  destination-owned ids, and never mutates the source project.
- Resources drop targets resolve to the explicit Pool root, the target folder,
  or the containing folder of a target file. Editable text targets consume only
  normalized `/pool/...` path text.
- Missing, stripped, malformed, unsupported, conflicting, or stale drag data is
  rejected without mutation or Undo registration.

## Paste Routing

| Active/focused context | Bar payload | Pool payload | Ordinary text |
|------------------------|-------------|--------------|---------------|
| Editable text/Monaco | Native paste | Native paste | Native paste |
| Timeline | Paste bars | Reject with context diagnostic | No project mutation |
| Resources | Reject with context diagnostic | Paste Pool roots | Existing text behavior |
| Other panel | No project mutation | No project mutation | Native/default behavior |

Cross-editor Pool drag is accepted only by Resources destinations. Existing
editable-target path insertion remains text-only, and other panels perform no
project mutation.

## Phoenix Reconciliation

No new Phoenix endpoint is introduced.

### Pasted bars

After destination transaction commit, each enabled/publication-eligible destination bar uses the existing single-section update API. New destination ids are used.

### Undone bar paste

After local Undo, destination ids use the existing many-section delete API.

### Pasted Pool resources

After destination transaction commit, existing scoped asset publication writes created directories/files in dependency order.

### Undone Pool paste

Existing scoped asset deletion removes destination files/directories in safe reverse order.

### Failure

- Disconnected: skip requests and keep local commit.
- Connected request failure: keep local commit and report destination ids/paths.
- No source project operation is sent to Phoenix.
