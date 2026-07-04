# Feature Specification: Graphics Settings Config

**Feature Branch**: `013-graphics-settings-config`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: User description: "Crear una ventana de configuracion de graficos que configure `/data/config/graphics` en Phoenix. Cacablu enviara la configuracion a Phoenix mediante un endpoint y Phoenix aplicara los cambios en memoria y creara `graphics.spo` en disco."

## Runtime Context *(mandatory)*

**Browser Surface**: Cacablu top menu, floating Graphics panel, project database session, Events panel, and Phoenix connection state.  
**Local Engine Dependency**: Phoenix is required only to transmit and apply graphics settings. The panel can open without Phoenix, but OK cannot complete engine transmission while disconnected.  
**Static Deployment Impact**: Cacablu remains a static browser app. It uses local project data, browser UI state, `fetch`, and the existing Phoenix editor API base URL.  
**Real-Time Sensitivity**: Opening and editing the panel must not affect timeline playback. The final OK request can block the panel until Phoenix responds.  
**File System Access Requirement**: Cacablu does not write Phoenix's `data/config` directly. Phoenix owns `data/config/graphics.spo`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Graphics Dialog From Edit Menu (Priority: P1)

As a user, I want to open graphics settings from `Edit > Graphics` so that rendering settings live beside other project editing actions.

**Independent Test**: Open Cacablu, open the Edit menu, verify Undo, separator, Cut, Copy, Paste, Delete, separator, Graphics, then select Graphics and verify the floating panel opens.

**Acceptance Scenarios**:

1. **Given** Cacablu is open, **When** the user opens the Edit menu, **Then** it includes `Graphics` after a horizontal separator below clipboard/delete commands.
2. **Given** the user selects `Edit > Graphics`, **When** the command runs, **Then** Cacablu opens a floating panel and the rest of the app remains usable.
3. **Given** no project is loaded, **When** the panel opens, **Then** it displays editable defaults or disabled project-backed fields without crashing.

---

### User Story 2 - Edit Rendering Context (Priority: P1)

As a user, I want to edit the rendering context settings so that Phoenix receives the screen and V-sync configuration I choose.

**Independent Test**: Open the panel, change color depth, width, height, fullscreen, and V-sync, press OK while Phoenix is connected, and verify the outgoing payload contains the selected values.

**Acceptance Scenarios**:

1. **Given** the Graphics panel is open, **When** it renders, **Then** it shows a `Rendering Context Settings` group with Color Depth, Width, Height, V-sync, and Full Screen controls.
2. **Given** a project is loaded, **When** the panel initializes, **Then** these controls are populated from the project graphics variables when available.
3. **Given** the user enters invalid width or height, **When** OK is pressed, **Then** Cacablu highlights the invalid field and does not send the payload.

---

### User Story 3 - Edit Generic FBO Table (Priority: P1)

As a user, I want to edit Phoenix's generic FBO table so that the generated `graphics.spo` matches the render buffers required by the demo.

**Independent Test**: Edit ratio rows and explicit-size rows, choose formats and filter values, press OK, and verify Cacablu sends exactly 25 FBO rows with normalized values.

**Acceptance Scenarios**:

1. **Given** the Graphics panel is open, **When** the FBO table renders, **Then** it shows columns `FBO`, `Ratio`, `Format`, `Width`, `Height`, `Attachments`, and `Filter`.
2. **Given** the table renders, **When** rows are shown, **Then** Cacablu displays FBO indexes `0` through `24`.
3. **Given** the user edits rows `0` through `19`, **When** those rows validate, **Then** they use ratio-based sizing and do not require width or height.
4. **Given** the user edits rows `20` through `24`, **When** those rows validate, **Then** they require explicit width and height.
5. **Given** the user opens a format menu, **When** the menu appears, **Then** it includes only Phoenix-supported formats: `RGB`, `RGBA`, `RGB_16F`, `RGBA_16F`, `RGB_32F`, `RGBA_32F`, `RG_16F`, `DEPTH`, `DEPTH_16F`, and `DEPTH_32F`.
6. **Given** the user opens a filter menu, **When** the menu appears, **Then** it offers `Bilinear` and `No`.

---

### User Story 4 - Send Graphics Settings To Phoenix (Priority: P1)

As a user, I want OK to send the graphics configuration to Phoenix so that the running engine and its `graphics.spo` file are updated together.

**Independent Test**: Connect Phoenix, open Graphics, change values, press OK, verify the endpoint is called, the panel remains open with applied feedback, and the Events panel receives any errors without alerts.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected and the panel has valid values, **When** the user presses OK, **Then** Cacablu sends a complete graphics payload to Phoenix.
2. **Given** Phoenix returns success, **When** Cacablu receives the response, **Then** the panel remains open, shows applied feedback, and the project graphics state is updated locally.
3. **Given** Phoenix returns validation, apply, or write errors, **When** Cacablu receives the response, **Then** the panel remains open and Cacablu writes the error to Events without showing an alert.
4. **Given** Phoenix is disconnected, **When** the user presses OK, **Then** Cacablu does not attempt transmission and writes a clear Event explaining that Phoenix is required to apply graphics settings.

### Edge Cases

- What happens when a project contains fewer or more than 25 FBO records?
- What happens when a project FBO uses a format not supported by Phoenix?
- What happens when Phoenix disconnects while the OK request is in flight?
- What happens when Phoenix accepts the config but reports a restart-required warning?
- What happens when the user cancels after editing many cells?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cacablu MUST add `Edit > Graphics` below the existing Edit commands and separated by a horizontal separator.
- **FR-002**: `Edit > Graphics` MUST open a floating panel.
- **FR-003**: The panel MUST include a `Rendering Context Settings` area with Color Depth, Width, Height, V-sync, and Full Screen controls.
- **FR-004**: The panel MUST include an editable FBO table with columns `FBO`, `Ratio`, `Format`, `Width`, `Height`, `Attachments`, and `Filter`.
- **FR-005**: The FBO table MUST contain exactly 25 Phoenix generic FBO rows indexed `0` through `24`.
- **FR-006**: Rows `0` through `19` MUST validate as ratio-based FBO rows.
- **FR-007**: Rows `20` through `24` MUST validate as explicit width/height FBO rows.
- **FR-008**: Format controls MUST use only Phoenix-supported FBO format names.
- **FR-009**: Filter controls MUST map `Bilinear` to `bilinear` and `No` to `none`.
- **FR-010**: OK MUST validate all fields before sending anything to Phoenix.
- **FR-011**: OK MUST send a complete graphics configuration to Phoenix when Phoenix is connected.
- **FR-012**: Cacablu MUST NOT write directly to Phoenix's `data/config/graphics.spo`.
- **FR-013**: Cacablu MUST update local project graphics state only after the panel values pass validation.
- **FR-014**: Cancel MUST discard all in-panel edits.
- **FR-015**: Phoenix errors MUST be written to Events and MUST NOT use browser alerts.
- **FR-016**: The panel MUST stay open when validation or Phoenix transmission fails.

### Key Entities

- **Graphics Dialog**: Modal UI opened from Edit for editing rendering context and FBO rows.
- **Rendering Context Settings**: Color depth, output width, output height, fullscreen, V-sync, and target FPS values.
- **FBO Row**: One generic Phoenix FBO entry with index, ratio or explicit dimensions, format, attachments, and filter.
- **Graphics Payload**: Normalized JSON request sent from Cacablu to Phoenix.
- **Graphics Event**: Events-panel diagnostic emitted when validation, connection, or Phoenix response errors occur.

