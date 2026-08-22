# Feature Specification: Phoenix Connectivity Preference

**Feature Branch**: `030-phoenix-connectivity-preference`  
**Created**: 2026-08-22  
**Status**: Draft  
**Input**: User description: "En la pastilla de conexión con Phoenix, añadir un checkbox circular para desactivar la conectividad y guardar esa preferencia en browser storage."

## Runtime Context

**Browser Surface**: Phoenix connection pill in the application top bar.  
**Local Engine Dependency**: Optional; disabling the preference must prevent communication even when Phoenix is running.  
**Static Deployment Impact**: Browser-only UI and preference persistence; no backend or project-file change.  
**Real-Time Sensitivity**: Disabling must stop reconnection promptly and must not interrupt unrelated editor interaction.  
**Storage Scope**: Origin-local application preferences in browser Web Storage, shared across projects in the same browser profile.

## User Scenarios & Testing

### User Story 1 - Disable Phoenix Connectivity (Priority: P1)

As a Cacablu user, I want a circular checkbox in the Phoenix connection pill so
that I can intentionally prevent Cacablu from communicating with Phoenix
without stopping either application.

**Why this priority**: Users need an explicit offline mode for editing,
debugging, and restarting Phoenix without continuous reconnection attempts.

**Independent Test**: Start with Phoenix connected, turn the checkbox off, and
verify that the current connection closes and no reconnect or Phoenix-bound
request is initiated while the preference remains disabled.

**Acceptance Scenarios**:

1. **Given** Phoenix connectivity is enabled, **When** the top bar renders,
   **Then** the connection pill contains a checked circular checkbox with an
   accessible name that communicates its purpose.
2. **Given** Phoenix is connected or connecting, **When** the user unchecks the
   control, **Then** Cacablu closes the active or pending connection, cancels
   scheduled reconnect attempts, clears runtime connection state, and presents
   a neutral disabled status rather than an error.
3. **Given** connectivity is disabled, **When** Phoenix starts, stops, or
   restarts, **Then** Cacablu makes no automatic reconnection attempt.
4. **Given** connectivity is disabled, **When** an editor action would normally
   synchronize with Phoenix, **Then** the local edit remains usable but no new
   Phoenix WebSocket, WebRTC, HTTP synchronization, or command traffic begins.
5. **Given** the checkbox has keyboard focus, **When** the user presses Space,
   **Then** it toggles with the same behavior as a pointer click.

---

### User Story 2 - Re-enable Phoenix Connectivity (Priority: P1)

As a user who has finished working offline, I want to re-enable the checkbox so
that Cacablu resumes its normal Phoenix connection lifecycle.

**Independent Test**: Disable connectivity, start Phoenix, re-enable
connectivity, and verify that Cacablu immediately begins its normal connection
flow and returns to the existing connected activity indication.

**Acceptance Scenarios**:

1. **Given** connectivity is disabled, **When** the user checks the control,
   **Then** Cacablu immediately begins one normal Phoenix connection attempt.
2. **Given** Phoenix is unavailable after re-enabling, **When** the connection
   fails, **Then** the existing error and reconnect behavior resumes without
   duplicate sockets or timers.
3. **Given** Phoenix connects after re-enabling, **When** traffic is exchanged,
   **Then** the existing connected glow and activity feedback continue to work.

---

### User Story 3 - Restore The Connectivity Preference (Priority: P1)

As a user, I want my Phoenix connectivity choice remembered so that restarting
Cacablu or Phoenix does not silently undo my offline preference.

**Independent Test**: Disable connectivity, reload Cacablu in the same browser
profile, and restart Phoenix; verify that the checkbox remains unchecked and
that no connection is attempted until the user enables it.

**Acceptance Scenarios**:

1. **Given** a stored disabled preference exists, **When** Cacablu starts,
   **Then** it restores the unchecked control before any Phoenix connection or
   synchronization attempt.
2. **Given** a stored enabled preference exists, **When** Cacablu starts,
   **Then** it restores the checked control and follows the existing automatic
   connection behavior.
3. **Given** no stored connectivity preference exists, **When** Cacablu starts,
   **Then** connectivity defaults to enabled for backward compatibility.
4. **Given** browser storage is unavailable or rejects a write, **When** the
   user toggles connectivity, **Then** the choice still applies for the current
   session without an uncaught error.
5. **Given** the stored preferences record is malformed or has an unsupported
   version, **When** Cacablu starts, **Then** it safely uses the enabled default
   and invalidates the unusable record when possible.

## Edge Cases

- The user disables connectivity while the WebSocket is still connecting.
- A reconnect timer is due in the same turn in which the user disables the
  preference.
- Phoenix closes the socket as a consequence of the intentional disconnect;
  that close event must not schedule another reconnect.
- The user toggles off and on rapidly; at most one active connection and one
  reconnect timer may exist.
- A Phoenix HTTP synchronization is already in flight when connectivity is
  disabled; it should be cancelled when its API supports cancellation, and no
  follow-up request may start while disabled.
- Browser storage contains valid preferences from a version that does not yet
  include the connectivity field.
- Multiple Cacablu tabs share the same origin; a new tab must read the latest
  stored value, while live cross-tab synchronization is outside this feature's
  scope.

## Requirements

### Functional Requirements

- **FR-001**: The Phoenix connection pill MUST contain a visible circular
  checkbox representing whether Phoenix connectivity is enabled.
- **FR-002**: The checkbox MUST be operable by pointer and keyboard and expose
  its checked state and an accessible label to assistive technology.
- **FR-003**: Enabled MUST remain the default when no stored preference exists.
- **FR-004**: Disabling connectivity MUST close any active or connecting
  Phoenix WebSocket and cancel every scheduled reconnect attempt.
- **FR-005**: An intentional disabled state MUST be displayed distinctly from
  disconnected and error states and MUST NOT use connected or error animation.
- **FR-006**: While disabled, Cacablu MUST NOT initiate Phoenix WebSocket,
  WebRTC, HTTP synchronization, or command traffic.
- **FR-007**: A socket close or error caused by disabling MUST NOT schedule a
  reconnect or surface a connection error.
- **FR-008**: Re-enabling connectivity MUST immediately resume the existing
  connection lifecycle with no duplicate socket or reconnect timer.
- **FR-009**: The enabled value MUST be stored as part of a versioned,
  browser-local application preferences record and MUST NOT be written to a
  project database or file.
- **FR-010**: The stored preference MUST be read and applied before the first
  automatic Phoenix connection attempt during application startup.
- **FR-011**: Missing connectivity fields in an otherwise compatible stored
  preferences record MUST use the enabled default without discarding other
  valid preferences.
- **FR-012**: Invalid JSON, invalid field types, unsupported versions, storage
  exceptions, security restrictions, and quota failures MUST NOT prevent
  Cacablu from starting or the current-session toggle from working.
- **FR-013**: Restarting Phoenix while connectivity is disabled MUST cause zero
  connection attempts; restarting Cacablu MUST restore the stored value.
- **FR-014**: Existing connected glow, activity feedback, reconnect behavior,
  and Phoenix protocols MUST remain unchanged while connectivity is enabled.
- **FR-015**: Disabling connectivity MUST NOT roll back or block local project
  and editor changes merely because their Phoenix synchronization is skipped.

## Key Entities

- **Application Preferences**: A versioned browser-local record containing
  user choices that apply to Cacablu independently of the open project.
- **Phoenix Connectivity Enabled**: A boolean application preference controlling
  whether any new Phoenix communication may be initiated.
- **Phoenix Connection State**: The runtime status shown in the pill; disabled
  is an intentional local mode rather than a transport failure.
- **Connectivity Toggle**: The circular, accessible checkbox embedded in the
  Phoenix pill and bound to the persisted preference.

## Success Criteria

- **SC-001**: Browser validation observes exactly zero Phoenix connection
  attempts for at least two normal reconnect intervals while disabled.
- **SC-002**: Disabling an open connection closes it and cancels reconnection
  before the next reconnect interval elapses.
- **SC-003**: Reloading Cacablu with a stored disabled value renders the control
  unchecked and produces zero startup Phoenix traffic.
- **SC-004**: Re-enabling produces one immediate connection attempt and the
  existing connected/activity presentation returns after Phoenix responds.
- **SC-005**: Unit tests cover enabled and disabled round trips, missing fields,
  malformed data, unsupported versions, and unavailable or failing storage.
- **SC-006**: Keyboard-only validation can focus, read, and toggle the control,
  and the disabled state remains understandable without relying on color.
- **SC-007**: Typecheck, focused tests, complete unit tests, changed-file lint,
  real-browser validation, and the production build complete without new
  errors.

## Assumptions

- The preference applies globally to the Cacablu origin and browser profile,
  not separately to each project.
- "Restarting the engine" includes Phoenix becoming unavailable and available
  again while Cacablu remains open; the disabled preference must continue to
  suppress reconnection.
- The existing connection pill remains the canonical place for Phoenix status.
- Live preference synchronization between already-open browser tabs is outside
  scope; each tab applies the stored value during its own startup.
- Existing local-edit and offline-event policies remain authoritative when a
  Phoenix synchronization is skipped.
