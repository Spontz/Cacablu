# Research: Cross-Project Copy And Paste

## Existing Clipboard Behavior

- Pool Copy stores recursive immutable `AssetClipboardNode` snapshots in one tab's `AssetClipboard`.
- Pool text paths are published through trusted native copy events for Monaco and other text destinations.
- Copy/Paste and Cut/Paste already allocate destination ids, reject conflicts atomically, support Undo, and reconcile Phoenix.
- Timeline has multi-bar selection, move collision checks, current-time state, and shared Undo, but no Copy/Paste or selected-layer state.
- App shell already routes Edit commands and protects text-editing targets.

## Decisions

### Self-contained browser clipboard

Use a versioned Cacablu JSON envelope in:

- `application/x-cacablu+json` when the browser preserves custom clipboard data.
- `text/html` with a Cacablu marker and base64-encoded envelope as a robust cross-tab fallback.
- `text/plain` for human/editor fallback (`/pool/...` paths for Pool payloads and a bar summary for Timeline payloads).

The destination never depends on a source session object, BroadcastChannel, or tab lifetime.

### Strict decode before allocation

The codec checks application id, exact supported version, kind, field types, finite numbers, safe ids, normalized Pool paths, base64 shape, declared byte counts, and total encoded size before returning a payload.

### Context routing in the shell

Native events remain authoritative:

- Editable target: native behavior.
- Active Timeline: bars only.
- Active Resources: Pool only.
- Mismatched Cacablu payload: diagnostic and no mutation.

Menu Paste uses `navigator.clipboard.read()` because it has no native `ClipboardEvent.clipboardData`.

### Timeline anchor

A simple empty-lane click selects the numeric layer and updates current time. Ruler/transport changes update time without clearing the layer. Multi-bar placement aligns earliest start/minimum layer to the target and preserves all offsets.

### Atomic rejection rather than placement repair

Pasted bars are not shifted to find space. Any destination overlap or invalid computed coordinate rejects the batch. Pool sibling conflicts retain existing case-insensitive atomic rejection.

### Copy-only between projects

Cross-tab payloads are immutable copy snapshots. Same-session Cut remains internal because safe cross-tab move would require distributed commit and source-tab lifetime guarantees.

## Alternatives Rejected

- **Only in-memory clipboard**: cannot cross tabs and fails after source closure.
- **BroadcastChannel/localStorage only**: not the system clipboard and unreliable for independent local-file origins/lifetime.
- **Opaque text-only JSON**: breaks normalized path paste into editors.
- **Automatic bar dependency scanning**: scripts are free-form and dependency inference would be incomplete.
- **Preserve source database ids**: conflicts with destination ownership.
- **Auto-shift collisions**: makes the explicit time/layer target nondeterministic.
- **Full Phoenix replacement**: unnecessary blast radius; existing scoped operations suffice.
