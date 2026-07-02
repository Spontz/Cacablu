# Research: Phoenix Data Asset Sync

## Decision: Require a loaded project before sync

**Decision**: Cacablu will not start manifest comparison or transfer asset operations unless a project is loaded.

**Rationale**: The loaded project establishes the authoritative editing context and prevents unrelated files from being pushed into Phoenix's active `data` folder.

**Alternatives considered**:

- Allow ad hoc folder sync without project context. Rejected because it weakens the safety model and makes UI discrepancy state ambiguous.
- Let Phoenix decide whether the sync is valid. Rejected because Cacablu already knows whether a project is loaded and can block earlier with clearer user feedback.

## Decision: Use published pool manifests for initial comparison

**Decision**: Cacablu collects enabled pool files from the loaded project database and compares their normalized paths and sizes with Phoenix's pool manifest.

**Rationale**: The enabled database state defines which pool files are published. Comparing before copying lets Cacablu skip an exact match and detect when Phoenix must be cleaned to avoid stale files.

**Alternatives considered**:

- Upload all files on every project open. Rejected because exact-match projects would waste time copying unchanged assets.
- Compare only file paths. Rejected because same-path files with different sizes would be missed.

## Decision: Clean Phoenix pool on non-exact initial sync

**Decision**: If Phoenix pool differs from the enabled project pool file set, Cacablu deletes Phoenix pool, recreates it, and uploads all enabled pool files in a blocking cancellable modal.

**Rationale**: A clean sync guarantees Phoenix does not retain stale files from a previous project while preserving a fast path when the manifest already matches.

**Alternatives considered**:

- Incrementally upload missing/changed files and leave extras. Rejected because extra files from previous projects remain visible to Phoenix.
- Ask the user to select Phoenix's `data` folder and write through the browser. Rejected because Phoenix owns its active data root and can safely apply operations through its API.

## Decision: Operation-based transfer

**Decision**: Cacablu sends explicit asset operations: create directory, write file, delete file, and delete directory.

**Rationale**: These operations map directly to resource management actions and make error reporting path-specific.

**Alternatives considered**:

- Batch sync the whole subtree. Rejected for the first version because partial failure and progress reporting are more complex.
- Use WebSocket only for all payloads. Rejected for initial design because HTTP is simpler for request/response file operations, while WebSocket remains useful for Phoenix change events.

## Decision: Replace all Phoenix sections when bars differ

**Decision**: Cacablu serializes database bars into Phoenix-compatible section payloads, compares that snapshot with Phoenix's current section manifest, and sends a full `replace-all` section request only when the snapshots differ.

**Rationale**: Project open establishes the authoritative timeline. A full replacement prevents stale sections from a previous project and mirrors the clean-pool behavior already used for assets. Exact-match comparison still avoids unnecessary runtime mutation.

**Alternatives considered**:

- Patch individual sections. Rejected for the first version because ordering, stale extras, and partial patch failure create more drift risks.
- Generate root `.spo` files and rely on filesystem reload. Rejected because the browser editor API should update Phoenix runtime sections directly without requiring a full demo reload.
- Use Phoenix's legacy raw TCP protocol directly from Cacablu. Rejected because browser JavaScript cannot use raw TCP and the native editor API already provides the browser-compatible channel.

## Decision: Use `.spo`-equivalent bar serialization

**Decision**: The canonical bar serialization matches the existing engine data export section format: `:::<type>`, `id`, `start`, `end`, `enabled`, `layer`, `blend`, `blendequation`, a blank line, and the raw script body.

**Rationale**: Phoenix already parses this section shape through its `.spo` and network-loading paths. Reusing the same semantics keeps Cacablu's project export, live section sync, and Phoenix section loader aligned.

**Alternatives considered**:

- Invent a new JSON-only section schema. Rejected because it would duplicate Phoenix section parsing rules and risk diverging from existing scripts.
- Compare only ids and timing fields. Rejected because changed script or blend state would not be detected.

## Decision: Scope only pool and resources

**Decision**: Cacablu scans and transfers only paths whose first segment is `pool` or `resources`.

**Rationale**: Phoenix config files affect engine startup and are out of scope for this live asset synchronization feature.

**Alternatives considered**:

- Include `config` in the same sync. Rejected because config lifecycle has different reload and safety concerns.

## Decision: Normalize paths before comparison or transfer

**Decision**: Paths use forward-slash relative form rooted at `data`, and Cacablu blocks absolute or traversal-like paths before sending operations.

**Rationale**: The same contract must work across Windows browser folder handles and Phoenix's filesystem implementation. Early normalization also makes discrepancy display stable.

**Alternatives considered**:

- Preserve native separators. Rejected because it complicates comparison and increases risk of sending platform-specific invalid paths.
