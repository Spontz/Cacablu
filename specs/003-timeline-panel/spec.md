# Feature Specification: Timeline Panel

**Feature Branch**: `003-timeline-panel`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Build a dedicated timeline panel like an animation timeline or After Effects timeline, with dense studio-style layers, scrubbing, transport controls, zoom via Shift + wheel, snapping, selection, and future keyframes by property."

## Runtime Context *(mandatory)*

**Browser Surface**: The docked timeline panel inside the main application shell, plus any timeline-focused demo surface used to validate the component  
**Local Engine Dependency**: The timeline can run with demo state, but it must be able to mirror and control a local playback engine when one is connected  
**Static Deployment Impact**: The panel must remain usable in a static browser app with no backend or server dependency  
**Real-Time Sensitivity**: Scrubbing, zooming, playback, and selection must remain responsive at interactive frame rates without blocking the UI thread  
**File System Access Requirement**: The timeline panel itself does not depend on File System Access API directly, but it must remain compatible with the host application's browser baseline

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and Scrub the Timeline (Priority: P1)

As a user, I want to see a dense timeline panel with layered tracks, a ruler,
and a visible playhead so that I can understand time and scrub to a specific
moment quickly.

**Why this priority**: A timeline is only useful if it immediately shows time,
layers, and current position.

**Independent Test**: Open the timeline panel, confirm the ruler and playhead
are visible, and click on the ruler to move the playhead to the clicked time.

**Acceptance Scenarios**:

1. **Given** the timeline panel is visible, **When** the panel loads, **Then**
   the user sees a dense studio-style timeline with layered bars and no extra
   helper header above the ruler.
2. **Given** the timeline panel is visible, **When** the user clicks on the
   ruler, **Then** the current time updates to the clicked position.

---

### User Story 2 - Control Playback from the Timeline (Priority: P2)

As a user, I want the timeline to provide a transport bar below the timeline so
that I can control playback without leaving the panel.

**Why this priority**: Playback is core to a timeline workflow and must be
available without consuming timeline space.

**Independent Test**: Use the transport bar to move to the beginning, rewind,
play or pause, advance, and jump to the end.

**Acceptance Scenarios**:

1. **Given** the timeline panel is visible, **When** the user activates the
   transport buttons, **Then** playback position updates accordingly.
2. **Given** the timeline is playing, **When** the user presses the play/pause
   button, **Then** playback toggles without losing the current time.
3. **Given** the timeline is visible, **When** the user uses the transport bar,
   **Then** no separate time slider or helper text is required.

---

### User Story 3 - Navigate and Edit Timeline Content (Priority: P3)

As a user, I want to zoom, select, move, trim, resize, split, duplicate, copy,
and paste items so that I can shape the sequence over time.

**Why this priority**: These are the core editing interactions that turn the
panel into a usable animation timeline rather than a read-only ruler.

**Independent Test**: Interact with the panel using shift-click, box selection,
dragging, and keyboard or clipboard actions to change the arrangement of clips.

**Acceptance Scenarios**:

1. **Given** the timeline panel is visible, **When** the user holds Shift and
   uses the mouse wheel, **Then** the timeline zoom changes while preserving
   the current focus area.
2. **Given** the timeline panel is visible, **When** the user scrolls the mouse
   wheel without modifiers, **Then** the panel scrolls vertically instead of
   zooming.
3. **Given** the timeline panel is visible, **When** the user uses shift-click
   or box-select, **Then** the selection updates without disturbing unselected
   items.
4. **Given** the timeline panel is visible, **When** the user duplicates or
   pastes selected items, **Then** the new items preserve relative timing.

---

### User Story 4 - Prepare for Property Keyframes (Priority: P4)

As a user, I want the timeline model to support keyframes by property so that
future animation curves and timed value changes can be added without redesigning
the panel.

**Why this priority**: Keyframes are part of the target animation workflow even
if the first release focuses on bars and transport.

**Independent Test**: Load a timeline model containing property channels and
verify that the panel can represent them without breaking the existing view.

**Acceptance Scenarios**:

1. **Given** a timeline model with property-based channels exists, **When** the
   panel loads it, **Then** the panel can retain those channels in state without
   losing the clip layout.
2. **Given** keyframes are present, **When** the user scrubs the playhead,
   **Then** the timeline can identify which property values are active at that
   time.

### Edge Cases

- What happens when the timeline is zoomed in so far that clips become wider
  than the visible viewport?
- What happens when the playhead reaches the beginning or end and the user
  continues rewinding or advancing?
- What happens when selection boxes overlap locked or disabled items?
- What happens when the local engine is absent but the timeline is still used as
  a standalone panel?
- What happens when a browser wheel event is unmodified and must be used for
  scroll rather than zoom?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a docked timeline panel that renders a
  dense studio-style timeline view.
- **FR-002**: The system MUST render a visible time ruler, playhead, and layered
  bars inside the timeline panel.
- **FR-003**: The system MUST allow the current time to be changed by clicking
  on the ruler.
- **FR-004**: The system MUST provide a transport bar below the timeline with
  controls for go to beginning, rewind, play/pause, forward, and go to end.
- **FR-005**: The system MUST support zoom via Shift + mouse wheel.
- **FR-006**: The system MUST preserve normal mouse wheel scrolling when no
  modifier key is held.
- **FR-007**: The system MUST support layered tracks that can be enabled or
  disabled independently.
- **FR-008**: The system MUST support selection through shift-click and box
  selection.
- **FR-009**: The system MUST support clip editing actions including move,
  trim, resize, split, duplicate, copy, and paste.
- **FR-010**: The system MUST support snapping against relevant timeline
  anchors such as grid points, clip boundaries, the playhead, and other
  time-based markers.
- **FR-011**: The system MUST model keyframes by property so that future timed
  value changes can be represented without redesigning the panel.
- **FR-012**: The timeline MUST remain usable in a static browser application
  without a backend service.
- **FR-013**: The timeline MUST remain compatible with the host browser
  baseline, including the project's File System Access API requirement.
- **FR-014**: The timeline MUST expose or integrate a playback model that can
  mirror a connected engine when available and continue to function in demo
  mode when it is not.
- **FR-015**: The default timeline UI MUST not include helper copy above the
  ruler or a visible zoom slider.
- **FR-016**: Timeline clip bars and labels MUST use a dense, studio-style
  presentation with square corners and single-line text that does not wrap.
- **FR-017**: Timeline clip bars MUST share a uniform vertical size and use a
  compact lane layout with reduced vertical spacing between tracks.
- **FR-018**: The transport bar buttons MUST use centered white icons on a
  dark blue raised background.

### Key Entities *(include if feature involves data)*

- **Timeline State**: The current transport, zoom, scroll, loop range,
  selection, and clipboard state of the panel.
- **Track**: A horizontal layer in the timeline that can be enabled, disabled,
  locked, or reordered.
- **Clip**: A time-bounded block placed on a track and editable through
  movement, trimming, resizing, duplication, and splitting.
- **Property Channel**: A future animation lane that stores keyframes for a
  specific property path.
- **Keyframe**: A time/value pair with interpolation metadata used to animate a
  property over time.
- **Transport Control**: A playback action that changes the current time or
  playback state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the timeline panel and see a ruler, layered bars,
  and a visible playhead without helper copy obscuring the timeline.
- **SC-002**: A user can click the ruler to move the playhead to a new time in a
  manual browser test.
- **SC-003**: A user can control playback through the transport bar below the
  timeline without a separate time slider.
- **SC-004**: Shift + wheel zoom and plain wheel scroll behave differently in the
  same browser session as specified.
- **SC-005**: The panel remains usable when loaded in a static browser build
  without a backend or engine connection.
- **SC-006**: Manual visual validation confirms the timeline feels dense and
  studio-like rather than calendar-like or spreadsheet-like.
- **SC-007**: Timeline clips render with square corners, a uniform height, and
  single-line labels that stay on one line during manual visual validation.
- **SC-008**: The track lanes are visibly compact, with reduced vertical spacing
  compared to the earlier timeline layout.
- **SC-009**: The transport buttons display centered white icons on a dark blue
  raised background during manual visual validation.
- **SC-010**: Project lint, typecheck, and build commands complete without new
  errors for the timeline implementation.

## Assumptions

- The first release focuses on the timeline panel UX, transport, and editing
  interactions rather than a full non-linear editor.
- The connected engine, when present, will supply or consume timeline state but
  is not required for the panel to render.
- Keyframes will initially be modeled in the data layer and surfaced in the UI
  later as the property animation tools mature.
- The timeline panel is expected to live inside the main shell but also be
  testable in a focused demo or sandbox surface.
