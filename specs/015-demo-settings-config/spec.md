# Feature Specification: Demo Settings Config

**Feature Branch**: `015-demo-settings-config`  
**Created**: 2026-07-05  
**Status**: Draft  
**Input**: User description: "Ventana Edit / Demo settings para configurar nombre de demo, loop, sonido, debug grid y log detail. Cacablu calcula demo_end desde las barras y Phoenix crea data/config/control.spo."

## Runtime Context *(mandatory)*

**Browser Surface**: Edit menu, floating Demo Settings panel, Events panel, timeline bars, Phoenix connection state, and loaded project database session.  
**Local Engine Dependency**: Phoenix is required to apply settings in memory and persist `data/config/control.spo`. The panel can open while Phoenix is disconnected, but applying settings requires a connection.  
**Static Deployment Impact**: Cacablu remains a static browser app and uses existing project DB APIs plus Phoenix editor API requests.  
**Real-Time Sensitivity**: Saving demo settings must be lightweight and must not trigger a full asset or section sync.  
**File System Access Requirement**: Cacablu never writes Phoenix's `data/config/control.spo` directly; Phoenix owns applying and writing the file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Demo Settings (Priority: P1)

As a user, I want to open Demo Settings from the Edit menu so that project-level demo controls are editable from Cacablu.

**Independent Test**: Open Cacablu, choose `Edit > Demo Settings`, and verify a centered floating panel appears with title, Loop demo, Sound, Debug grid, and Log detail controls.

**Acceptance Scenarios**:

1. **Given** Cacablu is open, **When** the user selects `Edit > Demo Settings`, **Then** Cacablu opens a floating Demo Settings panel.
2. **Given** the panel is open, **When** the user opens it again from the menu, **Then** Cacablu focuses the existing panel instead of opening a duplicate.
3. **Given** no project is loaded, **When** the panel opens, **Then** Cacablu shows editable defaults and disables apply actions that require a project-derived `demo_end`.

---

### User Story 2 - Edit Demo Control Values (Priority: P1)

As a user, I want to edit the demo title, loop, sound, debug grid, and log detail so that Phoenix receives the intended runtime control file.

**Independent Test**: Change all controls, apply the settings, and verify the payload contains the edited values and supported log detail value.

**Acceptance Scenarios**:

1. **Given** Demo Settings is open, **When** the user edits the title field, **Then** Cacablu stores the draft demo name.
2. **Given** Demo Settings is open, **When** the user toggles Loop demo, Sound, or Debug grid, **Then** Cacablu stores those draft boolean values.
3. **Given** Demo Settings is open, **When** the user chooses Log detail, **Then** the popup offers `None`, `Essential`, `Normal`, and `Verbose`.

---

### User Story 3 - Calculate Demo End From Bars (Priority: P1)

As a user, I want `demo_end` to be calculated from the timeline so that Phoenix renders the full demo.

**Independent Test**: Load a project whose latest bar ends at `120`, apply Demo Settings, and verify Cacablu sends `demoEnd: 120`.

**Acceptance Scenarios**:

1. **Given** a loaded project has bars, **When** Cacablu builds the Demo Settings payload, **Then** `demoEnd` equals the maximum bar end time.
2. **Given** a loaded project has no bars, **When** Cacablu builds the payload, **Then** `demoEnd` equals `0`.
3. **Given** a bar changes after Demo Settings is opened, **When** the user applies settings, **Then** Cacablu uses the current timeline value, not a stale value.

---

### User Story 4 - Apply Settings To Phoenix (Priority: P1)

As a user, I want applying Demo Settings to update Phoenix and create `control.spo` so that the runtime and disk configuration match Cacablu.

**Independent Test**: Connect Phoenix, apply settings, and verify Phoenix responds `ok: true` and writes `data/config/control.spo` with the expected values.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected and a project is loaded, **When** the user applies Demo Settings, **Then** Cacablu sends the settings to Phoenix's demo settings endpoint.
2. **Given** Phoenix accepts the settings, **When** Cacablu receives the response, **Then** Cacablu writes no alert and may close or leave the panel according to the chosen action.
3. **Given** Phoenix rejects the settings, **When** Cacablu receives the response, **Then** Cacablu writes a clear Events entry and keeps the draft open.
4. **Given** Phoenix is disconnected, **When** the user attempts to apply settings, **Then** Cacablu does not attempt a network write and writes a useful Events entry instead of an alert.

### Edge Cases

- What happens if the demo title is empty or whitespace?
- What happens if project bars contain invalid or negative end times?
- What happens if Phoenix has a legacy `control.spo` with `log_detail 4`?
- What happens if Phoenix disconnects while the settings request is in flight?
- What happens if there is no loaded project but the user opens the panel?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cacablu MUST add `Demo Settings` under the `Edit` menu, separated from cut/copy/paste commands by a horizontal separator.
- **FR-002**: Cacablu MUST open Demo Settings as a centered floating panel using Cacablu's existing panel styling and Mantine controls.
- **FR-003**: The panel MUST contain a demo title text field.
- **FR-004**: The panel MUST contain a `Loop demo` checkbox mapped to Phoenix `loop`.
- **FR-005**: The panel MUST contain a `Sound` checkbox mapped to Phoenix `sound`.
- **FR-006**: The panel MUST contain a `Debug grid` checkbox mapped to Phoenix `debugEnableGrid`.
- **FR-007**: The panel MUST contain a Log detail popup with values `0 None`, `1 Essential`, `2 Normal`, and `3 Verbose`.
- **FR-008**: Cacablu MUST NOT expose or write `log_detail 4`.
- **FR-009**: Cacablu MUST calculate `demoEnd` from the maximum end time of all timeline bars at apply time.
- **FR-010**: Cacablu MUST send `demoStart` as Phoenix's fixed `0.0` value only through the Phoenix contract if the endpoint requires it; otherwise Phoenix derives it.
- **FR-011**: Cacablu MUST send demo settings to Phoenix through the editor API and MUST NOT write Phoenix `data/config/control.spo` directly.
- **FR-012**: Cacablu MUST route validation, connection, and Phoenix response errors to Events and MUST NOT use blocking alerts.
- **FR-013**: Cacablu MUST avoid triggering full project sync when applying Demo Settings.
- **FR-014**: Cacablu MUST keep applying disabled or safely rejected when no project is loaded and `demoEnd` cannot be derived.
- **FR-015**: Cacablu SHOULD initialize the panel from Phoenix settings when Phoenix is connected, falling back to project defaults or built-in defaults when disconnected.

### Key Entities

- **Demo Settings Panel**: Floating panel opened from the Edit menu.
- **Demo Settings Draft**: Editable browser state for title, loop, sound, debug grid, and log detail.
- **Timeline Demo End**: Maximum bar end time calculated from the loaded project at apply time.
- **Demo Settings Payload**: Network payload sent from Cacablu to Phoenix.
- **Log Detail Option**: User-facing label mapped to Phoenix `LogLevel` values `0..3`.
