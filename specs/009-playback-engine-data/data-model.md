# Data Model: Playback Engine Data Export

## Playback Control State

Represents whether each transport control is available.

Fields:

- `projectReady`: boolean indicating that a SQLite project is open and resource structure can be built.
- `playEnabled`: boolean, true only when `projectReady` is true and no blocking export operation is active.
- `otherControlsEnabled`: boolean, false for this feature.
- `preparationStatus`: one of `idle`, `selecting-folder`, `writing-data`, `ready`, `error`.
- `lastError`: nullable user-facing error message.

Validation rules:

- Initial state has `projectReady=false`, `playEnabled=false`, and `otherControlsEnabled=false`.
- Loading a valid project sets `projectReady=true` and allows only Play.
- Failed or cleared project load returns controls to disabled state.
- Playback must not become active while `preparationStatus` is `selecting-folder`, `writing-data`, or `error`.

## Resource Tree Structure

Represents the same folder/file hierarchy shown in the Pool panel.

Fields:

- `roots`: ordered list of root `ResourceNode` items.
- `sourceProjectName`: optional display name from the loaded SQLite file.
- `generatedAt`: timestamp for export traceability.

Validation rules:

- Every folder and file must have a stable numeric database id.
- Parent-child relationships must be resolved from the loaded project data.
- Missing parents are treated as root-level items so no resource is dropped.
- Order should be deterministic: folders and files preserve current project order unless a later UI sort is introduced.

## Resource Node

Represents one folder or file.

Common fields:

- `kind`: `folder` or `file`.
- `id`: stable numeric project id.
- `name`: display name from the project.
- `path`: slash-delimited path within the resource tree.

Folder fields:

- `children`: ordered list of child `ResourceNode` items.
- `enabled`: enabled flag from the project when available.

File fields:

- `parentId`: numeric folder id or `0` for root.
- `type`: resource type from the project.
- `format`: resource format from the project.
- `bytes`: declared byte length from the project.
- `enabled`: enabled flag from the project.

Validation rules:

- `path` must be generated from tree position, not trusted from raw file names.
- Path separators in names must be escaped or represented so they cannot corrupt hierarchy.
- Duplicate names are allowed when ids or full paths differ.

## Visualization Engine Folder

Represents the user-granted writable folder where engine handoff data is created.

Fields:

- `handle`: browser folder handle retained only as allowed by the browser session.
- `displayName`: folder name for user feedback.
- `permissionState`: one of `granted`, `prompt`, `denied`, or `unknown`.

Validation rules:

- A write attempt may proceed only after user selection and write permission.
- Cancelled selection must not create or modify files.
- Denied permission must produce a recoverable error state.

## Engine Data Pool

Represents the generated local folder tree rooted at `data/pool`.

Fields:

- `dataDirectoryName`: exact value `data`.
- `poolDirectoryName`: exact value `pool`.
- `folders`: folders created from resource tree folder nodes.
- `files`: files created from SQLite file records.

Validation rules:

- `data` and `pool` must be directories.
- Root project files are written directly under `data/pool`.
- Nested project files are written under matching resource folders.
- Success can be reported only after all file writers are closed without error.
