# Data Model: Phoenix Data Asset Sync

## Project Asset Sync Gate

Represents whether Cacablu is allowed to start asset sync.

Fields:

- `projectLoaded`: boolean indicating whether a Cacablu project session is open.
- `projectDatabaseReady`: boolean indicating whether the loaded project's database contents are available.
- `blockedReason`: nullable reason such as `no-project`, `project-open-cancelled`, `phoenix-disconnected`, or `unsupported-browser`.

Validation rules:

- Asset comparison and transfer may start only when `projectLoaded=true`.
- File transfer may start only when `projectDatabaseReady=true`.
- Clearing or replacing the project resets sync state and pending operations.

## Published Pool Source

Represents the loaded project's database-backed pool files that are eligible for Phoenix publication.

Fields:

- `databaseFileName`: project database file name shown to users.
- `enabledFiles`: ordered list of database file rows whose enabled state is true.
- `treePath`: normalized pool-relative path derived from folder hierarchy and file name.
- `validationStatus`: one of `unknown`, `valid`, `invalid-path`, or `missing-file-data`.

Validation rules:

- Enabled database files become expected Phoenix entries under `pool/**`.
- Disabled database files are not expected Phoenix entries and are not transferred by initial sync.
- Phoenix destination folder selection is not part of this model; Phoenix owns its active `data` root.

## Asset Manifest

Represents files and directories under Phoenix `data/pool` and `data/resources`, or the expected enabled project pool files.

Fields:

- `root`: `project-published-pool` or `phoenix-engine`.
- `generatedAt`: timestamp for display and debugging.
- `entries`: ordered list of `AssetManifestEntry`.
- `errors`: list of path-specific manifest errors, if scanning was partial.

Validation rules:

- Project-published entries include enabled `pool/**` files; Phoenix entries include `pool/**` and `resources/**`.
- Paths are normalized to forward-slash relative form.
- Ordering is deterministic by normalized path.
- Missing database file bytes create an error state rather than silently marking sync as complete.

## Asset Manifest Entry

Represents one file or directory in a manifest.

Fields:

- `path`: normalized relative path such as `pool/shaders/basic.glsl`.
- `kind`: `file` or `directory`.
- `size`: file byte size for file entries.
- `hash`: optional content hash for file entries when supplied by Phoenix.

Validation rules:

- File entries require `size`; Phoenix manifest entries may include `hash`.
- Directory entries do not require `size` or `hash`.
- Absolute paths and `..` segments are invalid.

## Asset Discrepancy

Represents one difference between expected published project pool data and Phoenix engine pool data.

Fields:

- `path`: normalized relative path.
- `kind`: `extra-phoenix`, `missing-phoenix`, `changed`, or `type-mismatch`.
- `localEntry`: optional expected project entry.
- `phoenixEntry`: optional Phoenix manifest entry.
- `message`: user-facing summary.

Validation rules:

- A discrepancy always references one normalized path.
- Matching entries produce no discrepancy.
- File entries with different sizes are `changed` for initial project-open sync.

## Initial Pool Sync Operation

Represents the blocking project-open copy from Cacablu to Phoenix.

Fields:

- `phase`: `scanning`, `cleaning`, `copying`, `complete`, or `error`.
- `total`: number of enabled pool files expected for the project.
- `current`: number of files processed.
- `copied`: number of files written to Phoenix.
- `skipped`: number of files already present in an exact-match case.
- `failed`: number of per-file failures.
- `abortController`: browser abort controller used by the Cancel action.

Validation rules:

- If Phoenix pool matches exactly by path and size, no cleaning occurs.
- If Phoenix pool differs, Cacablu deletes and recreates Phoenix `pool` before copying.
- Cancelling aborts in-flight network work when possible and prevents the newly opened project session from becoming active.

## Project Bar Snapshot

Represents the loaded project's database `bars` serialized into the section set expected by Phoenix.

Fields:

- `databaseFileName`: project database file name shown to users.
- `bars`: ordered list of `ProjectBarSectionEntry`.
- `canonicalHash`: optional hash of the deterministic canonical section list.
- `generatedAt`: timestamp for display and debugging.

Validation rules:

- Every database bar is included, even when disabled; disabled bars become disabled Phoenix sections.
- Ordering is deterministic by database bar id or the order Phoenix expects for section script loading.
- The snapshot may be built only when the project database is ready.

## Project Bar Section Entry

Represents one database bar as a Phoenix-compatible section payload.

Fields:

- `id`: database bar id serialized as the Phoenix section id.
- `type`: trimmed database bar type, or `section` when empty.
- `startTime`: bar start time.
- `endTime`: bar end time.
- `enabled`: boolean enabled state.
- `layer`: numeric layer.
- `srcBlending`: source blend factor.
- `dstBlending`: destination blend factor.
- `blendingEQ`: blend equation.
- `script`: raw section script text.
- `canonicalText`: `.spo`-equivalent text containing header fields and script body.
- `hash`: optional hash of `canonicalText`.

Validation rules:

- `startTime` and `endTime` must be finite numbers.
- `type` must be non-empty after applying the `section` fallback.
- `canonicalText` must be equivalent to the section file format used by engine data export.

## Phoenix Section Manifest

Represents the runtime sections currently loaded in Phoenix.

Fields:

- `root`: `phoenix-sections`.
- `generatedAt`: timestamp for display and debugging.
- `sections`: ordered list of section manifest entries.
- `errors`: optional manifest or serialization errors.

Validation rules:

- Entries must include enough metadata to compare against `ProjectBarSectionEntry`.
- Ordering must be deterministic so exact-match checks do not fail because of response order alone.

## Section Replacement Operation

Represents one full section snapshot sent from Cacablu to Phoenix.

Fields:

- `requestId`: stable client-generated id for correlating responses.
- `sections`: all serialized project bars.
- `canonicalHash`: optional hash of the full section snapshot.
- `expectedWrittenFiles`: list of expected root `.spo` filenames such as `17.spo`.
- `expectedDeletedFiles`: list of root `.spo` filenames that should disappear because their sections are removed.
- `abortController`: browser abort controller used by the Cancel action.

Validation rules:

- Section replacement requires loaded project context.
- Section replacement runs after the initial pool sync completes or is skipped.
- If Phoenix sections already match the project snapshot, no replacement operation is sent.
- Cancelling aborts in-flight work when possible and prevents the newly opened project session from becoming active.
- Successful replacement means Phoenix persists one `<id>.spo` file directly under its active `data` folder for every received section.
- Successful replacement also means Phoenix deletes root `<id>.spo` files for sections removed from the runtime section set.

## Asset Operation

Represents one mutation sent from Cacablu to Phoenix.

Fields:

- `operation`: `create-directory`, `write-file`, `delete-file`, or `delete-directory`.
- `path`: normalized relative path under `pool` or `resources`.
- `bytes`: file bytes for `write-file`.
- `recursive`: boolean for directory deletion when needed.
- `requestId`: stable client-generated id for correlating responses.

Validation rules:

- Operations require loaded project context.
- Operations require a path under `pool` or `resources`.
- `write-file` requires bytes.
- `delete-directory` must be explicit about recursive behavior.

## Phoenix Asset Sync State

Represents UI/client state for the Phoenix asset sync workflow.

Fields:

- `connectionState`: `disconnected`, `connecting`, `connected`, or `error`.
- `syncState`: `blocked`, `idle`, `scanning`, `cleaning`, `copying`, `synchronized`, `applying`, or `error`.
- `manifest`: nullable expected published pool manifest.
- `phoenixManifest`: nullable Phoenix manifest.
- `barSnapshot`: nullable expected project bar snapshot.
- `phoenixSectionManifest`: nullable Phoenix section manifest.
- `discrepancies`: list of asset discrepancies.
- `pendingOperations`: list of pending asset operations.
- `lastError`: nullable user-facing error.

Validation rules:

- `blocked` is used when no project is loaded or the project-open sync is cancelled.
- `synchronized` requires both manifests and zero discrepancies.
- `discrepant` requires at least one discrepancy.
- Pending operations are cleared when Phoenix disconnects or the project changes.
