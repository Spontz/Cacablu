# Feature Specification: Portable Static Build

**Feature Branch**: `002-portable-static-build`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Make the application build portable so that the generated app can be opened directly in a browser by double-clicking the built index file."

## Delivery Modes

- Development mode through a local npm-driven dev server
- Portable packaged mode through generated static files
- Preview mode through a local static server using the generated build

## Runtime Context *(mandatory)*

**Browser Surface**: The packaged browser application opened from a generated local file  
**Local Engine Dependency**: The packaged app may still attempt to connect to the local visuals engine, but it must render its shell without requiring the engine to exist first  
**Static Deployment Impact**: The feature exists specifically to guarantee that the built output remains portable as static files, including direct opening from the local filesystem  
**Real-Time Sensitivity**: Packaging changes must not degrade the responsiveness of the shell once the app is running

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the Built App by Double Click (Priority: P1)

As a user, I want to open the built application by double-clicking its main HTML
file so that I can review or demo the app locally without running a development
server.

**Why this priority**: This is the main outcome of the feature and directly
addresses the packaging expectation for a static browser app.

**Independent Test**: Build the app, open the generated entry HTML file from the
filesystem, and confirm the shell loads in a supported browser.

**Acceptance Scenarios**:

1. **Given** the application has been built, **When** the user opens the built
   entry HTML file directly from the filesystem, **Then** the shell renders
   instead of showing a blank page.
2. **Given** the built app is opened from the filesystem, **When** the shell
   loads, **Then** the user can see the menu bar and workspace panels.

---

### User Story 2 - Keep the Build Portable (Priority: P2)

As a user, I want the generated build to keep all required assets in a portable
form so that I can move the output folder to another machine or location and
still open it locally.

**Why this priority**: Portability is the point of supporting local file
opening; a build that only works in one machine-specific path does not solve the
problem.

**Independent Test**: Move or copy the build output folder and confirm that the
main HTML file still opens correctly from the new location.

**Acceptance Scenarios**:

1. **Given** the build output exists, **When** the output folder is moved to a
   different local path, **Then** the app still opens correctly from the new
   location.
2. **Given** the app uses compiled scripts and styles, **When** the built HTML
   is opened locally, **Then** all referenced assets resolve through portable
   relative paths.

---

### User Story 3 - Understand Runtime Limits (Priority: P3)

As a user, I want the local-openable build to make its limits clear so that I
understand what works offline or without a local engine connection.

**Why this priority**: A filesystem-openable app can still have runtime limits,
and those limits must not be confusing.

**Independent Test**: Open the built app locally without an engine connection
and confirm that the UI still communicates the connection state clearly.

**Acceptance Scenarios**:

1. **Given** the local build is opened without a running engine, **When** the
   app starts, **Then** it remains usable and shows a non-blocking disconnected
   state.
2. **Given** some capability requires HTTP hosting or a live engine in the
   future, **When** the local build is used without it, **Then** the limitation
   is surfaced clearly rather than failing silently.

---

### Edge Cases

- What happens when the built app is opened from a filesystem path containing spaces?
- What happens when the browser applies stricter `file://` restrictions than it
  does over HTTP?
- What happens when a relative asset path is generated incorrectly during build?
- What happens when the local engine connection cannot be established from the
  locally opened build?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST produce a built application output that can be
  opened directly from the local filesystem in a supported browser.
- **FR-002**: The system MUST ensure that built script and style asset
  references resolve through portable relative paths.
- **FR-003**: The system MUST preserve the existing shell experience when the
  app is opened locally from built output.
- **FR-004**: The system MUST continue to support static hosting from a normal
  HTML server in addition to direct local opening.
- **FR-005**: The system MUST surface connection state clearly when no local
  visuals engine is available.
- **FR-006**: The system MUST document any runtime limitations that still apply
  when the built app is opened through `file://`.
- **FR-007**: The system MUST keep the packaging approach compatible with the
  browser-only, backend-free architecture.
- **FR-008**: The system MUST provide a clear npm-based workflow for
  development, packaging, and previewing the built output.

### Key Entities *(include if feature involves data)*

- **Portable Build Output**: The generated application folder containing the
  entry HTML and all required assets.
- **Asset Reference**: A path from the built HTML or built scripts to another
  required static asset.
- **Runtime Limitation Notice**: A visible explanation of behavior that may be
  reduced or unavailable when the app is opened locally.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the built application from the local filesystem in
  a supported browser and see the shell load successfully.
- **SC-002**: The built output remains functional after the output directory is
  copied to a different local path.
- **SC-003**: Manual validation confirms that the local build shows the menu bar,
  workspace panels, and connection status.
- **SC-004**: The standard project typecheck, lint, test, and build checks pass
  for the packaging change.
- **SC-005**: A developer can identify a documented command for each of these
  tasks: development, packaging, and preview of the built output.

## Assumptions

- The source project may continue using TypeScript as long as the build output
  remains browser-executable JavaScript.
- The filesystem-openable workflow targets generated build output rather than the
  raw source `index.html`.
- Some future capabilities may still work better under HTTP hosting, but the
  shell itself must load locally from built files.
