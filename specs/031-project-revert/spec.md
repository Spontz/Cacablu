# Feature Specification: Revert Saved Project

**Feature Branch**: `031-project-revert`  
**Created**: 2026-08-22  
**Status**: Implemented  
**Input**: Add `File > Revert`, confirm before discarding pending changes, reload the latest saved project, and synchronize it with Phoenix.

## Runtime Context

**Browser Surface**: File menu, native confirmation dialogs, project-backed panels, Events, and Phoenix synchronization progress.  
**Local Engine Dependency**: Optional. A connected Phoenix is synchronized immediately; a disconnected Phoenix receives the reloaded project through the existing reconnect coordinator.  
**File System Access Requirement**: Reuses the file handle of the currently open project and opens no new picker.  
**Destructive Scope**: Unsaved in-memory project changes may be discarded only after explicit confirmation.

## User Scenarios & Testing

### User Story 1 - Reload A Clean Project (Priority: P1)

As a user, I want to reload the last saved version of the open project so that
external file changes or an unwanted editor state can be replaced without
choosing the file again.

**Independent Test**: Open a clean project, choose `File > Revert`, confirm,
and verify that the same file handle is reread and the project panels show its
saved contents.

**Acceptance Scenarios**:

1. **Given** no project is open, **When** File is opened, **Then** Revert is disabled.
2. **Given** a clean project is open, **When** Revert is selected, **Then** Cacablu asks for confirmation before reloading it.
3. **Given** the confirmation is cancelled, **When** control returns to Cacablu, **Then** the current session, selection, Undo history, and Phoenix state remain unchanged.
4. **Given** reload succeeds, **When** the replacement session is installed, **Then** selections and stale Undo history are cleared and an informational Event identifies the reloaded file.

### User Story 2 - Protect Unsaved Changes (Priority: P1)

As a user with pending changes, I want one clear choice to discard or cancel
before Revert so that the command cannot silently destroy my work.

**Independent Test**: Exercise Discard and Cancel on a dirty project and verify
disk bytes and active project content after each branch.

**Acceptance Scenarios**:

1. **Given** the project is dirty, **When** Revert starts, **Then** Cacablu asks once whether to discard unsaved changes and reload.
2. **Given** discard is confirmed, **When** Revert proceeds, **Then** Cacablu reloads the last bytes already present on disk.
3. **Given** discard confirmation is cancelled, **When** control returns, **Then** no project or Phoenix mutation occurs.

### User Story 3 - Synchronize The Reloaded Project (Priority: P1)

As a user, I want Revert to synchronize the restored project with Phoenix so
that the editor and engine return to the same saved state.

**Independent Test**: Revert while connected and verify pool assets, demo
settings, graphics, and sections are synchronized from the reloaded session.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected, **When** the saved project is reloaded, **Then** Cacablu performs the existing complete project synchronization and forces section replacement before committing the new editor session.
2. **Given** immediate synchronization fails, **When** Revert reports the error, **Then** the original editor session remains active.
3. **Given** Phoenix is disconnected, **When** Revert succeeds locally, **Then** the reloaded session becomes pending in the existing coordinator and synchronizes after Phoenix reconnects.

## Requirements

- **FR-001**: File MUST contain a `Revert` action after the save actions.
- **FR-002**: Revert MUST be disabled unless a project session is open and idle.
- **FR-003**: Revert MUST reuse the current project file handle and MUST NOT open a file picker.
- **FR-004**: A clean project MUST require confirmation before reload.
- **FR-005**: A dirty project MUST show exactly one explicit Discard confirmation and MUST treat rejection as Cancel.
- **FR-007**: The saved file MUST be read into a replacement session before the current session is closed.
- **FR-008**: A read, validation, cancellation, or immediate Phoenix-sync failure MUST close any temporary session and retain the current one.
- **FR-009**: Successful Revert MUST clear project selections, Timeline paste destination, section error markers, active loop selection, and application Undo history.
- **FR-010**: Successful Revert MUST reset dirty state and publish the replacement through the shared session reference.
- **FR-011**: Connected Revert MUST run full project synchronization and force Phoenix section replacement from the reloaded data.
- **FR-012**: Disconnected Revert MUST register the reloaded session as pending for synchronization on reconnect.
- **FR-013**: Revert MUST produce one informational Event on success and a visible error on failure.
- **FR-014**: Concurrent or repeated invocation MUST NOT install a replacement over a different project session.

## Success Criteria

- **SC-001**: Unit tests prove clean confirmation and the single dirty-project Discard or Cancel decision.
- **SC-002**: A database-session test proves reload ignores unsaved memory changes and reads the same handle's persisted bytes.
- **SC-003**: Manual validation proves the File action enablement, successful UI refresh, cleared Undo history, and failure preservation behavior.
- **SC-004**: Connected validation observes one complete Phoenix project synchronization based on reloaded data.
- **SC-005**: Typecheck, focused tests, complete tests, changed-file lint, and build complete without new errors.

## Assumptions

- Dirty state represents changes already applied to the in-memory project database; un-applied control drafts remain owned by their editor.
- Revert never saves implicitly; users save separately with the existing Save action when they want to retain changes.
- Existing synchronization services remain authoritative for pool, settings, graphics, sections, and reconnect behavior.
