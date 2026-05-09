# Research: Playback Engine Data Export

## Decision: Use the browser folder picker and writable file handles

**Rationale**: The project constitution intentionally targets browsers with File System Access support. The requested workflow requires the browser to ask the user for the visualization engine folder and then write a file into that folder. A user-initiated folder picker matches browser security requirements and preserves the no-backend deployment model.

**Alternatives considered**:

- Download a `data` file and ask the user to move it manually. Rejected because it does not satisfy creating the file inside the selected engine folder.
- Use a local helper process. Rejected because it would add a backend/companion process to normal UI logic.

## Decision: Write resource files under `data/pool`

**Rationale**: The visualization engine needs a disk folder that mirrors the project resource tree. Creating `data/pool` and writing the SQLite file bytes into matching folders lets the engine consume normal filesystem paths while preserving project names and hierarchy.

**Alternatives considered**:

- JSON manifest. Rejected because the engine needs the files on disk, not just a description of them.
- Single archive file. Rejected because the requested output is an actual directory tree.

## Decision: Export resource bytes from SQLite

**Rationale**: The SQLite `files` records already contain each resource's binary data. Writing those bytes under `data/pool` gives the engine the actual project assets while still using the existing in-memory `ProjectDatabase`.

**Alternatives considered**:

- Export only empty placeholder files. Rejected because the engine would not receive the resources.
- Export metadata only. Rejected because it does not satisfy writing the contained files.

## Decision: Play prepares engine data but does not launch playback yet

**Rationale**: Browsers cannot reliably launch arbitrary local executables from a static app, and the current spec only requires folder selection plus `data` file creation. The UI should not report playback as active until preparation succeeds and a later engine playback contract exists.

**Alternatives considered**:

- Toggle the current in-browser timeline playback immediately. Rejected because it would conflict with the requirement that Play first prepares the engine folder.
- Attempt executable detection and launch. Rejected as outside browser static app capabilities and outside the feature scope.

## Decision: Extract shared resource tree logic from Pool panel behavior

**Rationale**: The existing Pool panel already builds a folder/file tree from `ProjectDatabase`, but its helper is private and tied to rendering. A shared pure model function lets the panel and export service produce the same hierarchy and enables focused unit tests.

**Alternatives considered**:

- Duplicate tree construction inside the export service. Rejected because it risks mismatch between visible tree and exported tree.
- Serialize DOM nodes from the Pool panel. Rejected because export should depend on project data, not current expansion state or rendered markup.
