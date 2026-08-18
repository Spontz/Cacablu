# Feature Specification: About Panel

**Feature Branch**: `026-about-panel`  
**Created**: 2026-08-18  
**Status**: Implemented  
**Input**: User description: "Crear una ventana About como panel adicional del menú Panels. Por ahora solo mostrará la fecha y hora del último commit Git en formato YYYY-MM-DD HH:MM:SS."

## Runtime Context

**Browser Surface**: Panels menu and one additional dockable About panel.  
**Local Engine Dependency**: None. The panel works with Phoenix disconnected.  
**Static Deployment Impact**: The Git timestamp is embedded during development startup or production build, so the delivered browser bundle remains static and requires no Git executable at runtime.  
**Real-Time Sensitivity**: Opening and rendering the panel must be immediate and must not perform runtime process, network, database, or filesystem work.  
**File System Access Requirement**: None.

## User Scenarios & Testing

### User Story 1 - Inspect The Build Revision Time (Priority: P1)

As a user, I want to open an About panel and see when the repository's latest commit was created so I can identify the source revision age of the running build.

**Why this priority**: This is the complete initial value of the panel.

**Independent Test**: Read the latest Git commit timestamp, open Panels > About, and verify the panel contains exactly the same timestamp in `YYYY-MM-DD HH:MM:SS` format.

**Acceptance Scenarios**:

1. **Given** Cacablu is running, **When** the user opens the Panels menu, **Then** an enabled About action is present.
2. **Given** the About panel is closed, **When** the user chooses Panels > About, **Then** one dockable panel titled `About` opens.
3. **Given** the About panel is visible, **When** its content renders, **Then** it displays the committer date and time of the latest repository commit in `YYYY-MM-DD HH:MM:SS` format.
4. **Given** the About panel is already open, **When** the user chooses Panels > About again, **Then** the existing panel is activated instead of creating a duplicate.
5. **Given** Phoenix is disconnected and no project is open, **When** About is opened, **Then** the timestamp remains available.

### Edge Cases

- The latest commit timestamp contains a timezone offset; the displayed value uses the local timezone of the development/build environment.
- The static bundle is opened on a machine without Git; the embedded timestamp remains available.
- Git is unavailable or the source directory has no commits during development/build; configuration fails with a clear error instead of emitting a misleading timestamp.
- The panel is closed and reopened repeatedly; only one About panel instance exists.

## Requirements

### Functional Requirements

- **FR-001**: The Panels menu MUST contain an `About` action.
- **FR-002**: Activating `About` MUST open or focus one dockable panel titled `About`.
- **FR-003**: The About panel MUST display the committer timestamp of the latest Git commit.
- **FR-004**: The timestamp MUST use the exact `YYYY-MM-DD HH:MM:SS` shape with zero-padded numeric fields.
- **FR-005**: The timestamp MUST be resolved during Vite configuration/startup or build and embedded in client code; browser runtime MUST NOT invoke Git.
- **FR-006**: The displayed timestamp MUST remain independent of project state, File System Access, Phoenix, and network availability.
- **FR-007**: Opening About repeatedly MUST NOT create duplicate panel instances.
- **FR-008**: The initial About panel MUST contain no product metadata beyond the requested last-commit timestamp.
- **FR-009**: The feature MUST preserve static deployment and add no runtime dependency.

### Key Entities

- **Build Revision Timestamp**: Immutable string derived from the latest commit's committer date and embedded in the browser bundle.
- **About Panel**: Dockable workspace panel that renders the build revision timestamp.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Panels > About opens one panel in a single user action.
- **SC-002**: The displayed value matches `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$` and equals the latest Git commit timestamp used at build/startup.
- **SC-003**: Reopening About produces exactly one panel instance.
- **SC-004**: The production `dist` displays the embedded timestamp without Git, Phoenix, a project database, or a backend.
- **SC-005**: Typecheck, focused tests, lint for changed code, and production build pass without new errors.

## Assumptions

- "Fecha y hora del último commit" means the latest commit's committer timestamp, not author timestamp or application build completion time.
- With no timezone format requested, the display uses the local timezone of the environment running Vite.
- About is available from the Panels menu but is not opened automatically in the initial layout.
