# Feature Specification: Phoenix Time Sync

**Feature Branch**: `main`  
**Created**: 2026-06-29  
**Status**: Draft  
**Input**: User description: "Implementar primero la funcionalidad que nos permita sincronizar el tiempo entre Cacablu y Phoenix. Mostrar en Cacablu el tiempo de Phoenix, y que los cinco botones debajo de la barra de tiempo funcionen."

## Runtime Context *(mandatory)*

**Browser Surface**: The docked timeline panel in the main Cacablu shell, specifically the ruler/playhead display and the five transport buttons below the time bar.  
**Local Engine Dependency**: Requires a local Phoenix instance running in slave mode with the native editor WebSocket API available. The timeline must remain usable and non-crashing when Phoenix is absent.  
**Static Deployment Impact**: Cacablu remains a static browser app with no backend; it connects directly to Phoenix using browser-native WebSocket APIs.  
**Real-Time Sensitivity**: Runtime time updates must move the playhead smoothly enough for editing feedback without blocking the UI thread.  
**File System Access Requirement**: This feature does not add new file-system requirements; existing project load/export flows remain separate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Timeline to Phoenix Time (Priority: P1)

As a user, I want Cacablu to show the current Phoenix time so that the timeline playhead reflects what Phoenix is actually playing.

**Why this priority**: The integration is not useful until Cacablu mirrors Phoenix's runtime clock.

**Independent Test**: Start Phoenix in slave mode with the editor API enabled, open Cacablu, and verify the timeline time/playhead updates from Phoenix runtime messages.

**Acceptance Scenarios**:

1. **Given** Phoenix is running in slave mode and exposing the editor WebSocket, **When** Cacablu connects, **Then** the timeline shows the current Phoenix time.
2. **Given** Phoenix is playing, **When** Phoenix streams runtime state, **Then** Cacablu moves the playhead dynamically using the streamed time.
3. **Given** Phoenix is not connected, **When** the timeline panel loads, **Then** Cacablu remains usable and the existing toolbar connection indicator shows that Phoenix is disconnected.
4. **Given** Phoenix is not connected, **When** the user views the transport bar, **Then** all five transport buttons are disabled.

---

### User Story 2 - Control Phoenix from the Five Transport Buttons (Priority: P1)

As a user, I want the five transport buttons below the time bar to control Phoenix so that I can navigate playback from Cacablu.

**Why this priority**: Transport control is the first bidirectional interaction between the editor and Phoenix.

**Independent Test**: Connect Cacablu to Phoenix and press each transport button: go to beginning, rewind, play/pause, forward, and go to end. Confirm Phoenix receives and applies each command.

**Acceptance Scenarios**:

1. **Given** Cacablu is connected to Phoenix, **When** the user presses Go to Beginning, **Then** Cacablu sends a seek command to time `0`.
2. **Given** Cacablu is connected to Phoenix, **When** the user presses Rewind, **Then** Cacablu sends a seek command for a time before the current Phoenix time.
3. **Given** Cacablu is connected to Phoenix, **When** the user presses Play/Pause, **Then** Cacablu sends a playback toggle command to Phoenix.
4. **Given** Cacablu is connected to Phoenix, **When** the user presses Forward, **Then** Cacablu sends a seek command for a time after the current Phoenix time.
5. **Given** Cacablu is connected to Phoenix, **When** the user presses Go to End, **Then** Cacablu sends a seek command to the known Phoenix end time or timeline duration.

---

### User Story 3 - Handle Connection States Clearly (Priority: P2)

As a user, I want Cacablu to show whether Phoenix is connected so that I understand why live time or controls may not be active.

**Why this priority**: The editor and Phoenix are separate processes, so disconnects and startup order must be clear.

**Independent Test**: Open Cacablu before Phoenix, then start Phoenix, then stop Phoenix. Confirm the timeline reflects disconnected, connected, and disconnected states without UI failure.

**Acceptance Scenarios**:

1. **Given** Phoenix is not available, **When** Cacablu attempts to connect, **Then** the timeline reports a disconnected or connection-error state without throwing.
2. **Given** Phoenix becomes available after Cacablu has loaded, **When** Cacablu reconnects or the user refreshes, **Then** runtime state can begin updating the playhead.
3. **Given** Phoenix disconnects while Cacablu is open, **When** the WebSocket closes, **Then** Cacablu stops sending commands and keeps the last known time visible.

### Edge Cases

- What happens when Phoenix sends malformed JSON?
- What happens when Phoenix sends a runtime time outside the known timeline duration?
- What happens when Phoenix has no end time or reports an end time of zero?
- What happens when the user presses a transport button while the WebSocket is connecting?
- What happens when a seek command is sent and Phoenix responds with the next runtime state slightly later?
- What happens when the local demo timeline has a different duration than Phoenix?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST connect to Phoenix using a browser-native WebSocket endpoint configured for the local Phoenix editor API.
- **FR-002**: The system MUST receive structured `runtime.state` messages from Phoenix.
- **FR-003**: The system MUST update the timeline transport current time from Phoenix's streamed runtime time.
- **FR-004**: The system MUST move the visible timeline playhead when Phoenix runtime time changes.
- **FR-005**: The system MUST update local playback state from Phoenix's streamed playing/status value.
- **FR-006**: The system MUST update timeline duration/end time from Phoenix runtime state when Phoenix provides a valid end time.
- **FR-007**: The system MUST keep Cacablu usable when Phoenix is disconnected, connecting, or reporting errors, using the existing toolbar connection indicator for connection messages.
- **FR-008**: The system MUST make all five transport buttons below the time bar functional when Phoenix is connected.
- **FR-009**: The Go to Beginning button MUST send a Phoenix seek command to time `0`.
- **FR-010**: The Rewind button MUST send a Phoenix seek command to a clamped time before the current runtime time.
- **FR-011**: The Play/Pause button MUST send `runtime.toggle` so Phoenix toggles playback from its authoritative runtime state.
- **FR-012**: The Forward button MUST send a Phoenix seek command to a clamped time after the current runtime time.
- **FR-013**: The Go to End button MUST send a Phoenix seek command to the known Phoenix end time, or the local timeline duration when no Phoenix end time is known.
- **FR-014**: The system MUST avoid sending transport commands while Phoenix is disconnected.
- **FR-015**: The system MUST disable all five transport buttons while Phoenix is disconnected, connecting, or in an error state.
- **FR-016**: The system MUST preserve the existing browser-only/static deployment model and MUST NOT add a Cacablu backend.
- **FR-017**: The system MUST keep the existing engine data export workflow separate from live Phoenix transport control.

### Key Entities *(include if feature involves data)*

- **Phoenix Connection State**: The client-side status of the WebSocket connection: disconnected, connecting, connected, or error.
- **Phoenix Runtime State**: The latest runtime state received from Phoenix, including current time, playing state, FPS, start time, and end time when available.
- **Transport Command**: A user action from one of the five transport buttons translated into a Phoenix WebSocket message.
- **Timeline Transport State**: The local timeline state that renders current time, duration, and play/pause icon state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With Phoenix running in slave mode, Cacablu shows Phoenix's current time within one second of opening the app.
- **SC-002**: While Phoenix is playing, the Cacablu playhead visibly moves in response to Phoenix runtime state updates.
- **SC-003**: Each of the five transport buttons sends the correct Phoenix command in manual validation.
- **SC-004**: Pressing transport buttons while disconnected does not throw errors or change Phoenix state.
- **SC-005**: Stopping Phoenix while Cacablu is open does not crash the timeline panel.
- **SC-006**: When Phoenix is disconnected, all five transport buttons are visibly disabled in manual validation.
- **SC-007**: `npm run typecheck`, `npm run lint`, and `npm run build` complete without new errors after implementation.

## Assumptions

- Phoenix will expose its first native editor WebSocket endpoint at a local URL agreed with the Phoenix OpenSpec implementation.
- Runtime messages use JSON and include a `type` field.
- The first transport step size for rewind/forward can be a small fixed value, such as one second, unless Phoenix later exposes frame-step commands.
- Launching Phoenix from Cacablu is outside this feature.
- Section timeline editing and `data` folder asset management are outside this feature.
