# Feature Specification: Application Shell Layout

**Feature Branch**: `001-app-shell-layout`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Create a base application skeleton for Cacablu with a menu bar, dockable window system, and a foundation that can be served as a static browser app."

## Runtime Context *(mandatory)*

**Browser Surface**: The entire primary application window shown in the browser, including the docked timeline panel and its transport controls  
**Local Engine Dependency**: The shell must be ready to connect to the local visuals engine, but the initial skeleton must still load without an active engine connection  
**Static Deployment Impact**: The shell must work when served as static files from a simple HTML server or opened locally in a browser without any backend  
**Real-Time Sensitivity**: The shell must preserve responsiveness while handling future timeline, resource, and engine events

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the Workspace (Priority: P1)

As a user, I want the application to open into a stable workspace shell so that
I have an immediate place to start working.

**Why this priority**: Without a base shell, no other feature can be explored,
validated, or demonstrated.

**Independent Test**: Open the app in a browser and confirm that the shell
renders a menu bar plus a usable multi-panel workspace without any engine
connection.

**Acceptance Scenarios**:

1. **Given** the static app is opened in a modern browser, **When** the initial
   page loads, **Then** the user sees a top menu bar and a dockable central
   workspace.
2. **Given** the app starts with no local engine connected, **When** the shell
   renders, **Then** the workspace still loads with sensible placeholder panels
   and no blocking error state.

---

### User Story 2 - Work with the Timeline Panel (Priority: P2)

As a user, I want the timeline panel to show a dense studio-style sequence
view with a ruler, layered bars, playhead, and transport controls so that I can
review and control timing from the main workspace.

**Why this priority**: The timeline is a primary working surface and should be
usable from the first shell iteration.

**Independent Test**: Open the app and confirm that the timeline panel renders
a ruler, layered bars, a visible playhead, and a transport bar below the
timeline.

**Acceptance Scenarios**:

1. **Given** the shell is visible, **When** the timeline panel loads, **Then**
   the user sees a dense timeline view with layered bars and no empty helper
   header above it.
2. **Given** the timeline panel is visible, **When** the user uses the
   transport controls below the timeline, **Then** the play/pause and time
   navigation actions update the current time without requiring a separate
   slider.
3. **Given** the timeline panel is visible, **When** the user clicks on the
   ruler, **Then** the playhead jumps to the clicked time.

---

### User Story 3 - Reorganize the Workspace (Priority: P3)

As a user, I want to move and resize workspace panels so that I can adapt the
interface to the way I work.

**Why this priority**: Flexible layout is a core capability for a creative tool
that will host resources, timeline, preview, and inspector panels.

**Independent Test**: Drag, dock, and resize panels in the workspace and
confirm that the layout remains usable throughout the session.

**Acceptance Scenarios**:

1. **Given** the workspace is visible, **When** the user drags a panel into a
   different dock position, **Then** the panel relocates without breaking the
   rest of the layout.
2. **Given** the workspace is visible, **When** the user resizes panel groups,
   **Then** the interface updates immediately and remains visually coherent.

---

### User Story 4 - Use the Main Menus (Priority: P4)

As a user, I want a menu bar with basic workspace actions so that I can discover
and trigger common actions from a predictable place.

**Why this priority**: Menus establish the interaction pattern for future file,
view, window, and help actions.

**Independent Test**: Open the top-level menus and trigger actions that affect
panel visibility or layout reset.

**Acceptance Scenarios**:

1. **Given** the shell is visible, **When** the user opens a top-level menu,
   **Then** the menu items are readable and actionable.
2. **Given** the user changes the layout, **When** the user selects the reset
   workspace action, **Then** the layout returns to the default arrangement.

---

### Edge Cases

- What happens when the app loads before any connection to the local visuals
  engine exists?
- How does the shell behave if the browser viewport is too small for the default
  layout proportions?
- What happens when a panel is closed and the user needs to recover it from the
  menu bar?
- What happens when a future engine message arrives before the related panel has
  initialized?
- What happens when the browser lacks a future optional performance API while
  still being within the supported modern browser set?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a single-window application shell in the
  browser.
- **FR-002**: The system MUST provide a top menu bar with at least File, View,
  Window, and Help menus.
- **FR-003**: The system MUST provide a dockable multi-panel workspace with a
  default arrangement suitable for resources, timeline, preview, inspector, and
  event output.
- **FR-004**: The system MUST allow users to move and resize workspace panels
  during a session.
- **FR-005**: The system MUST provide a way to restore the default layout after
  the user changes it.
- **FR-006**: The system MUST load successfully without a local visuals engine
  connection and expose a non-blocking connection status.
- **FR-007**: The system MUST define the initial browser-side contract surface
  for future WebSocket communication categories used by the shell.
- **FR-008**: The system MUST remain deployable as a static application with no
  backend dependency.
- **FR-009**: The system MUST preserve user-perceived responsiveness during
  layout interaction and menu usage.
- **FR-010**: The system MUST keep the shell code understandable, with clear
  module boundaries and comments where behavior is not obvious.
- **FR-011**: The timeline panel MUST render a dense studio-style ruler, layered
  bars, a visible playhead, and a transport bar beneath the timeline content.
- **FR-012**: The timeline panel MUST allow scrubbing by clicking the ruler
  rather than via a separate time slider.
- **FR-013**: The timeline panel MUST provide transport buttons for go to
  beginning, rewind, play/pause, forward, and go to end.
- **FR-014**: The timeline panel MUST support zooming through `Shift` plus
  mouse wheel, while the unmodified wheel scrolls vertically.
- **FR-015**: The timeline panel MUST not display helper copy above the ruler or
  a visible zoom slider in the default UI.
- **FR-016**: The timeline panel MUST render clip bars with square corners and
  labels that stay on a single line without wrapping.
- **FR-017**: The timeline panel MUST keep clip bars at a uniform height and
  use compact vertical spacing between tracks.
- **FR-018**: The timeline panel MUST render transport buttons as centered
  white icons on a dark blue raised background.

### Key Entities *(include if feature involves data)*

- **Workspace Layout**: The arrangement of visible panels, their positions, and
  their sizing within the main application shell.
- **Panel Definition**: The metadata that describes an individual workspace
  panel, including its identifier, title, default role, and visibility rules.
- **Timeline Panel**: The docked workspace panel that shows the ruler, layered
  bars, playhead, and transport controls for time-based interaction.
- **Timeline Transport**: The controls used to navigate time, including
  beginning, rewind, play/pause, forward, and end actions.
- **Menu Action**: A user-triggered command exposed through the menu bar that
  affects the shell or workspace state.
- **Connection State**: The current browser-side view of whether the local
  visuals engine is disconnected, connecting, connected, or errored.
- **Engine Message Category**: A high-level classification for future shell
  traffic such as resource data, timeline updates, engine events, and status
  messages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the application shell in a supported browser and
  reach a usable workspace in under 3 seconds on a normal development machine.
- **SC-002**: A user can reposition and resize the default panels without layout
  corruption during a manual test session.
- **SC-003**: The timeline panel renders a ruler, layered bars, playhead, and
  transport bar without exposing helper text or a visible zoom slider.
- **SC-004**: A user can click the ruler to scrub the playhead and use the
  transport bar to move through time without a separate time slider.
- **SC-005**: The shell remains usable and visually coherent when no local
  visuals engine is connected.
- **SC-006**: A user can recover the default workspace layout in one menu action.
- **SC-007**: The timeline panel shows square-corner clip bars and single-line
  labels without wrapping during manual visual validation.
- **SC-008**: The timeline panel shows uniform-height clips and compact track
  spacing during manual visual validation.
- **SC-009**: The timeline transport buttons show centered white icons on a
  dark blue raised background during manual visual validation.
- **SC-010**: Manual visual validation confirms that the core shell loads,
  menus open, timeline interactions behave as expected, and workspace
  interactions remain usable in at least one supported browser.
- **SC-011**: Project lint, typecheck, and build commands complete without new
  errors for the shell implementation.

## Assumptions

- The first shell iteration focuses on layout and interaction scaffolding rather
  than real engine-driven visuals.
- Persistent layout storage across browser sessions is out of scope for this
  initial skeleton unless it comes almost for free.
- The local visuals engine contract can begin as a documented placeholder surface
  before real message handlers exist.
- The initial visual language can be minimal as long as the interface is clear,
  stable, and ready to extend.
