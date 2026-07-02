# Feature Specification: Phoenix Data Asset Sync

**Feature Branch**: `011-phoenix-data-asset-sync`  
**Created**: 2026-07-01  
**Status**: Draft  
**Input**: User description: "Cuando abramos un proyecto en el editor, los assets publicados del pool se enviarán a Phoenix para que los cree en su carpeta data. Tiene que haber un proyecto cargado para que la transferencia de archivos se lleve a cabo."

## Runtime Context *(mandatory)*

**Browser Surface**: The main Cacablu shell, project asset/resource workflow, timeline/bar workflow, and any management UI that creates, edits, deletes, moves, enables, disables, or organizes files under the loaded project's pool/resources database trees. The visible project pool tree is labeled as Assets.
**Local Engine Dependency**: Requires a local Phoenix instance running in slave mode with the native editor HTTP/WebSocket API available. Cacablu must remain usable when Phoenix is absent.  
**Static Deployment Impact**: Cacablu remains a static browser app with no backend; it uses browser-native File System Access APIs, `fetch`, and `WebSocket` to coordinate with Phoenix.  
**Real-Time Sensitivity**: Asset sync operations are user-visible and should keep UI feedback responsive, but they are not frame-time critical.  
**File System Access Requirement**: Requires a loaded Cacablu project database. Cacablu must not ask the user to select Phoenix's destination `data` folder for publishing; Phoenix owns the destination folder.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Require Project Context Before Sync (Priority: P1)

As a user, I want Cacablu to transfer files only when a project is loaded so that files from an unrelated folder cannot be pushed into Phoenix by mistake.

**Why this priority**: The loaded project defines which `data` folder is authoritative for the editing session.

**Independent Test**: Open Cacablu without a project and attempt to start data sync or asset transfer. Confirm no manifest comparison or Phoenix file operation is sent.

**Acceptance Scenarios**:

1. **Given** no project is loaded, **When** the user attempts an asset sync action, **Then** Cacablu does not transfer files to Phoenix.
2. **Given** no project is loaded, **When** a local resource create/edit/delete action is attempted, **Then** no Phoenix asset mutation is sent.
3. **Given** a project is selected, **When** the project opens successfully, **Then** Cacablu may begin manifest comparison and initial pool publication with Phoenix.

---

### User Story 2 - Compare Published Pool With Phoenix Data (Priority: P1)

As a user, I want Cacablu to compare the loaded project's published pool files with Phoenix so that Phoenix does not keep stale assets from another project.

**Why this priority**: The editor and engine must operate on matching assets for preview and runtime behavior to be trustworthy.

**Independent Test**: Load a project, run Phoenix in slave mode, then compare exact-match and intentionally different Phoenix `pool` contents.

**Acceptance Scenarios**:

1. **Given** a project is loaded and Phoenix is connected, **When** the project opens, **Then** Cacablu collects enabled pool files from the project database as the expected published manifest.
2. **Given** Phoenix is connected, **When** expected pool collection completes, **Then** Cacablu requests Phoenix's active engine manifest.
3. **Given** the expected enabled pool file paths and sizes exactly match Phoenix's `pool`, **When** comparison completes, **Then** Cacablu skips copying and marks those files already present.
4. **Given** Phoenix has missing, extra, or size-mismatched pool files, **When** comparison completes, **Then** Cacablu clears Phoenix's pool and uploads all enabled pool files from the project.
5. **Given** the user cancels the initial sync, **When** cancellation is accepted, **Then** Cacablu closes the newly opened session and leaves the workspace without that project/pool loaded.

---

### User Story 3 - Mirror Project Asset Changes Into Phoenix (Priority: P2)

As a user, I want asset changes made in Cacablu under `pool` or `resources` to be sent to Phoenix so that the running engine receives the same files as the editor project.

**Why this priority**: Once the folders are known, normal editor file management should keep Phoenix's `data` folder aligned.

**Independent Test**: With a project loaded and Phoenix connected, create, replace, delete, and create/delete directories under `pool` and `resources`; verify Phoenix confirms each operation.

**Acceptance Scenarios**:

1. **Given** a project is loaded and Phoenix is connected, **When** a file is created or replaced under local `pool`, **Then** Cacablu sends a Phoenix write operation for the same relative path.
2. **Given** a project is loaded and Phoenix is connected, **When** a file is created or replaced under local `resources`, **Then** Cacablu sends a Phoenix write operation for the same relative path.
3. **Given** a project is loaded and Phoenix is connected, **When** a file is deleted under local `pool` or `resources`, **Then** Cacablu sends a Phoenix delete file operation for the same relative path.
4. **Given** a project is loaded and Phoenix is connected, **When** a directory is created or deleted under local `pool` or `resources`, **Then** Cacablu sends the corresponding Phoenix directory operation.
5. **Given** Phoenix rejects an operation, **When** Cacablu receives the error, **Then** Cacablu shows a non-blocking operation error and refreshes discrepancy state.
6. **Given** a project is loaded and Phoenix is connected, **When** a pool file is moved to another folder, **Then** Cacablu updates the database hierarchy and mirrors the resulting Phoenix file path change.

---

### User Story 4 - Keep Sync Safely Scoped (Priority: P2)

As a user, I want Cacablu to sync only `pool` and `resources` so that config files and unrelated local files are not modified through this workflow.

**Why this priority**: Phoenix's writable editor API is intentionally narrow and must not become general filesystem access.

**Independent Test**: Try to transfer paths under `config`, absolute paths, and traversal-like paths; verify Cacablu prevents or warns and Phoenix is not asked to mutate them.

**Acceptance Scenarios**:

1. **Given** a project is loaded, **When** a file under `config` changes, **Then** Cacablu does not send a Phoenix asset mutation for that path.
2. **Given** a candidate path resolves outside `pool` or `resources`, **When** Cacablu evaluates it, **Then** Cacablu blocks the transfer and reports the path as out of scope.
3. **Given** a path contains backslashes, **When** Cacablu builds a manifest or operation, **Then** Cacablu normalizes the path to forward-slash relative form before comparison or transfer.

---

### User Story 5 - Publish Project Bars As Phoenix Sections (Priority: P1)

As a user, I want Cacablu to publish the loaded project's bars to Phoenix as runtime sections so that Phoenix plays the same timeline that I opened in the editor.

**Why this priority**: Asset sync alone is not enough; Phoenix also needs the section timeline that consumes those assets.

**Independent Test**: Load a project with bars while Phoenix is running, compare the exact-match and changed-section cases, and confirm Phoenix sections are skipped or fully replaced accordingly.

**Acceptance Scenarios**:

1. **Given** a project is loaded and Phoenix is connected, **When** the initial pool sync completes or is skipped, **Then** Cacablu serializes every database bar into a Phoenix section payload.
2. **Given** Phoenix's current sections exactly match the serialized bars, **When** comparison completes, **Then** Cacablu does not send a section replacement request.
3. **Given** Phoenix has any missing, extra, or changed section relative to Cacablu's bars, **When** comparison completes, **Then** Cacablu sends one full section replacement request containing all project bars.
4. **Given** section replacement succeeds, **When** Phoenix confirms the operation, **Then** Cacablu expects Phoenix to have created one `<id>.spo` file per received section directly under its active `data` folder.
5. **Given** section replacement succeeds, **When** Phoenix confirms the operation, **Then** Cacablu completes project opening and the timeline/engine are considered aligned.
6. **Given** the user cancels during bar/section sync, **When** cancellation is accepted, **Then** Cacablu aborts in-flight work where possible and leaves the project unopened.

### Edge Cases

- What happens when Phoenix is not running or the editor API is disconnected?
- What happens when Cacablu is opened from `file://` or another insecure origin and Chrome blocks local Phoenix requests?
- What happens when local manifest hashing fails for a file?
- What happens when a file changes locally during manifest generation?
- What happens when Phoenix reports a path that differs only by case on Windows?
- What happens when a large binary asset is edited or uploaded?
- What happens when Cacablu loses Phoenix connection while an operation is pending?
- What happens when Phoenix applies the file but cannot emit a WebSocket change event?
- What happens when the user cancels initial sync after Phoenix pool has already been cleared?
- What happens when Phoenix has sections from a previous project but the new project has zero bars?
- What happens when a bar has an empty type, invalid timing, unsupported blend metadata, or malformed script?
- What happens when section replacement succeeds but a section references a pool asset that failed to upload?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a loaded Cacablu project before starting Phoenix asset comparison or file transfer.
- **FR-002**: The system MUST associate asset sync with the loaded project database, not an arbitrary destination folder selected outside project context.
- **FR-003**: The system MUST publish only project assets that are in scope for `pool` or `resources`.
- **FR-003a**: The system MUST present a segmented switcher between `Assets` and `Resources`, where `Assets` represents `data/pool` and `Resources` represents `data/resources`.
- **FR-003b**: The Assets view MUST show each pool file's database `enabled` state as a checkbox on project load.
- **FR-004**: The system MUST build the expected published pool manifest from enabled database files using normalized relative paths and file sizes.
- **FR-005**: The system MUST request Phoenix's active engine asset manifest when Phoenix is connected and local manifest scanning succeeds.
- **FR-006**: The system MUST compare expected published pool files and Phoenix pool files, treating missing, extra, or size-mismatched files as a non-exact match.
- **FR-007**: The system MUST present synchronized, discrepant, disconnected, and blocked-no-project states distinctly.
- **FR-008**: The system MUST prevent Phoenix transfer actions while no project is loaded.
- **FR-009**: The system MUST send create/replace file operations to Phoenix only for relative paths under `pool` or `resources`.
- **FR-010**: The system MUST send delete file operations to Phoenix only for relative paths under `pool` or `resources`.
- **FR-011**: The system MUST send create/delete directory operations to Phoenix only for relative paths under `pool` or `resources`.
- **FR-012**: The system MUST NOT send asset mutations for `config` or any path outside `pool` and `resources`.
- **FR-012a**: The system MUST transfer pool files to Phoenix only when their database `enabled` state is true, and disabled pool files MUST NOT be treated as expected Phoenix file entries.
- **FR-012b**: On project open, if Phoenix pool does not exactly match the enabled project pool file set by path and size, the system MUST delete Phoenix pool recursively, recreate it, and upload all enabled pool files.
- **FR-012c**: On project open, if Phoenix pool exactly matches the enabled project pool file set by path and size, the system MUST skip deleting and copying those files.
- **FR-012d**: The initial project pool sync MUST be shown in a small blocking modal with progress and a Cancel action.
- **FR-012e**: If the user cancels initial project pool sync, Cacablu MUST abort in-flight Phoenix requests when possible and MUST NOT publish the opened project session to the workspace.
- **FR-012f**: Cacablu MUST NOT expose a UI section for selecting Phoenix's destination `data` folder.
- **FR-013**: The system MUST normalize path separators to forward slashes before comparing or sending paths.
- **FR-014**: The system MUST avoid sending absolute paths or traversal paths to Phoenix.
- **FR-015**: The system MUST handle Phoenix asset success and error responses without crashing the shell.
- **FR-015a**: When browser networking blocks Phoenix requests, the system MUST show a clear Phoenix connection error instead of only surfacing a raw `Failed to fetch` message when enough context is available.
- **FR-016**: The system MUST refresh or update discrepancy state after Phoenix confirms or rejects an asset operation.
- **FR-017**: The system MUST preserve the static browser-only deployment model and MUST NOT add a Cacablu backend.
- **FR-018**: The system MUST keep existing Phoenix time sync and preview behavior separate from asset sync state.
- **FR-019**: On project open, after the initial pool sync completes or is skipped, the system MUST build an expected section snapshot from every database bar.
- **FR-020**: The system MUST serialize each bar with id, type, start time, end time, enabled state, layer, source blend factor, destination blend factor, blend equation, and raw script text.
- **FR-021**: The system MUST serialize empty or whitespace-only bar type as `section`.
- **FR-022**: The canonical serialized bar text MUST be equivalent to a Phoenix root `.spo` section containing `:::<type>`, `id`, `start`, `end`, `enabled`, `layer`, `blend`, `blendequation`, one blank line, and the script body.
- **FR-023**: The system MUST request Phoenix's section manifest when Phoenix is connected and a loaded project is being opened.
- **FR-024**: The system MUST compare expected project bars with Phoenix sections by id, type, start/end, enabled state, layer, blend metadata, and script content or canonical script hash.
- **FR-025**: If the expected bars exactly match Phoenix's sections, the system MUST skip section replacement.
- **FR-026**: If any expected bar or Phoenix section is missing, extra, or changed, the system MUST send a full section replacement request containing all project bars.
- **FR-027**: Section replacement MUST be part of the blocking project-open sync and cancellation MUST leave Cacablu without the newly opened project loaded.
- **FR-028**: The system MUST preserve Cacablu's static browser-only deployment model and use the Phoenix editor API rather than the legacy raw TCP protocol directly.
- **FR-029**: After successful section replacement, Phoenix MUST persist every received section as `<id>.spo` directly under its active `data` folder.
- **FR-030**: Persisted section files MUST use the canonical `.spo` format: `:::<type>`, `id`, `start`, `end`, `enabled`, `layer`, `blend`, `blendequation`, one blank line, and raw script body.
- **FR-031**: When Phoenix deletes a section during full replacement or another editor section operation, Phoenix MUST delete the corresponding root `<id>.spo` file from its active `data` folder.

### Key Entities *(include if feature involves data)*

- **Loaded Project**: The current Cacablu project session that authorizes asset sync and owns the selected `data` folder.
- **Project Database**: The browser-granted SQLite project file containing folders, files, file bytes, and publish/enable state used by the asset sync workflow.
- **Assets View**: The Cacablu view backed by the loaded project's pool tree, represented on disk as `data/pool`.
- **Resources View**: The Cacablu view backed by the loaded project's `data/resources` folder.
- **Published Pool Manifest**: A normalized list of enabled project files expected under Phoenix `data/pool`.
- **Asset Discrepancy**: A difference between local project data and Phoenix data, classified by relative path and type.
- **Asset Operation**: A create directory, write file, delete file, or delete directory request sent from Cacablu to Phoenix.
- **Phoenix Asset Sync State**: Client state describing whether Phoenix is disconnected, comparing, synchronized, discrepant, applying, blocked, or error.
- **Project Bar Snapshot**: A deterministic serialized list of project database bars expected to exist as Phoenix runtime sections.
- **Phoenix Section Manifest**: A structured list of current Phoenix runtime sections returned by the editor API.
- **Section Replacement Operation**: A full snapshot operation that asks Phoenix to delete all current runtime sections and recreate them from Cacablu bars.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no project loaded, 100% of asset sync attempts are blocked before any Phoenix transfer request is sent.
- **SC-002**: With a loaded project and matching Phoenix data, Cacablu reports synchronized state after manifest comparison.
- **SC-003**: With a loaded project and intentionally different Phoenix pool data, Cacablu clears Phoenix pool and copies every enabled project pool file in manual validation.
- **SC-004**: File create, replace, delete, directory create, and directory delete actions under `pool` or `resources` produce the expected Phoenix operation in manual validation.
- **SC-005**: Attempts involving `config`, absolute paths, or traversal paths produce no Phoenix mutation request.
- **SC-006**: Phoenix disconnection or operation failure leaves Cacablu usable and shows a recoverable state.
- **SC-007**: `npm run typecheck`, `npm run lint`, and `npm run build` complete without new errors after implementation.
- **SC-008**: With matching project bars and Phoenix sections, Cacablu sends no section replacement request in manual validation.
- **SC-009**: With changed, missing, or extra Phoenix sections, Cacablu sends a full section replacement and Phoenix ends with the same section count and canonical fields as the project bars.
- **SC-010**: Invalid section replacement errors leave Cacablu usable and do not mark project-open sync as complete.
- **SC-011**: After section replacement, Phoenix's active `data` folder contains `<id>.spo` files for the received sections and their content matches the canonical bar serialization.
- **SC-012**: After a replacement removes a previously published section, Phoenix's active `data` folder no longer contains that removed section's `<id>.spo` file.

## Assumptions

- Phoenix exposes the asset manifest and mutation contract described in the paired Phoenix OpenSpec change `sync-data-assets-with-editor`.
- Phoenix exposes the section manifest and full replacement contract described in the paired Phoenix OpenSpec change `sync-data-assets-with-editor`.
- The first implementation can send one asset operation at a time; batch sync can be added later.
- The first section synchronization implementation can replace all sections on mismatch rather than patching individual bars.
- Immediate Phoenix runtime hot-reload is outside this feature; this feature coordinates files on disk and reports operation outcomes.
