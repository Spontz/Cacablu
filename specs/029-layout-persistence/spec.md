# Feature Specification: Persistent Workspace Layout

**Feature Branch**: `029-layout-persistence`  
**Created**: 2026-08-21  
**Status**: Implemented  
**Input**: User description: "Guardar el layout cada vez que el usuario lo cambie en browser storage y aplicarlo cuando abra Cacablu."

## User Scenarios & Testing

### User Story 1 - Restore The Previous Workspace (Priority: P1)

As a Cacablu user, I want the panel layout from my previous session to return when I reopen the application so that I can continue working with the same workspace.

**Independent Test**: Arrange docked and floating panels, reload Cacablu in the same browser profile, and verify that the same panels, groups, sizes, positions, and active group are restored.

**Acceptance Scenarios**:

1. **Given** a valid saved layout exists, **When** Cacablu starts, **Then** Dockview restores it before the user starts interacting with the workspace.
2. **Given** no saved layout exists, **When** Cacablu starts, **Then** the application uses its existing initial layout behavior.
3. **Given** a restored layout exists, **When** the user opens a project, **Then** project initialization does not replace the restored panel arrangement with default positions.

### User Story 2 - Persist Every Layout Change (Priority: P1)

As a Cacablu user, I want workspace changes saved automatically so that I do not need a separate Save Layout command.

**Independent Test**: Add, close, move, resize, float, and activate panels and verify that Dockview's latest serialized layout is stored after each layout-change notification.

**Acceptance Scenarios**:

1. **Given** Cacablu is open, **When** Dockview reports a layout change, **Then** the current serialized layout is written to browser storage.
2. **Given** the user closes every panel through Reset Layout, **When** Cacablu is reopened, **Then** the intentionally empty saved layout is restored.
3. **Given** storage access or quota fails, **When** the layout changes, **Then** Cacablu remains usable without surfacing an uncaught error.

### User Story 3 - Recover From Invalid Saved Data (Priority: P2)

As a user upgrading Cacablu or recovering from damaged browser state, I want an invalid stored layout to be ignored so that the application can still open.

**Independent Test**: Seed malformed JSON, an unsupported storage version, and a Dockview payload that cannot be restored; verify fallback to the initial layout and removal of the invalid entry.

## Requirements

- **FR-001**: Cacablu MUST serialize layouts with Dockview's `toJSON()` representation.
- **FR-002**: Cacablu MUST persist the serialized representation when Dockview emits `onDidLayoutChange`.
- **FR-003**: The stored record MUST include an application-controlled schema version.
- **FR-004**: Cacablu MUST restore a valid stored layout with Dockview's `fromJSON()` during workspace mount.
- **FR-005**: A missing layout MUST retain the existing first-run behavior.
- **FR-006**: Invalid JSON, an unsupported version, an invalid payload, or a Dockview restoration error MUST fall back safely and invalidate the unusable entry.
- **FR-007**: Browser-storage read, write, removal, security, and quota errors MUST NOT prevent application startup or interaction.
- **FR-008**: An intentionally empty layout MUST be distinguishable from no saved preference.
- **FR-009**: Opening or changing projects MUST preserve an already restored or user-modified workspace arrangement.
- **FR-010**: Persistence MUST remain browser-local and MUST add no backend, Phoenix, database, filesystem, or runtime-dependency requirement.

## Success Criteria

- **SC-001**: A browser test confirms that all panels in a saved docked/floating layout reopen after workspace reconstruction.
- **SC-002**: Unit tests cover round-trip persistence, missing data, malformed data, unsupported versions, and unavailable storage.
- **SC-003**: A corrupt saved entry produces zero uncaught startup errors and is removed when possible.
- **SC-004**: Typecheck, unit tests, changed-file lint, browser validation, and the production build pass.

## Assumptions

- Layout preference is global to the browser profile and Cacablu origin, not project-specific.
- Dockview owns the serialized geometry and active-group format; Cacablu only envelopes and versions it.
- Panel-specific editing state is outside scope. This feature restores workspace layout, not unsaved editor text or project selection.
