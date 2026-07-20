# Feature Specification: Delete Selected Timeline Bars

**Feature Branch**: `022-delete-selected-timeline-bar`  
**Created**: 2026-07-17  
**Status**: Implemented  
**Input**: User description: "Si selecciono una barra y pulso Supr o Backspace, hay que borrarla, notificar a Phoenix y el borrado ha de poderse deshacer."

## Runtime Context

**Browser Surface**: Global Cacablu keyboard routing, Timeline selection/rendering, Edit > Undo, and Events diagnostics.  
**Local Engine Dependency**: Phoenix is optional for local deletion and Undo. When connected in editor mode, Cacablu removes deleted runtime sections and republishes restored eligible sections through the existing section API.  
**Static Deployment Impact**: Cacablu remains a static browser application. Local persistence uses the already-open in-memory SQLite session and engine synchronization uses browser `fetch`.  
**Real-Time Sensitivity**: A keypress must update local state and Timeline immediately. Phoenix I/O must remain asynchronous and must not block editing.  
**File System Access Requirement**: Opening and saving the project still requires the existing File System Access workflow; deletion itself adds no new browser API requirement.

## User Scenarios & Testing

### User Story 1 - Delete Selected Bars With Standard Keys (Priority: P1)

As a timeline editor, I want `Delete` and `Backspace` to remove the selected bars so that deletion behaves like a standard editing command.

**Why this priority**: Keyboard deletion is the primary requested interaction and must be reliable before Undo or engine synchronization matters.

**Independent Test**: Select one or multiple bars, press each deletion key, and verify only the selected existing bars disappear from the project and Timeline.

**Acceptance Scenarios**:

1. **Given** one existing bar is selected and focus is outside an editable control, **When** the user presses `Delete`, **Then** Cacablu removes the bar from the project and Timeline and clears its selection.
2. **Given** one existing bar is selected and focus is outside an editable control, **When** the user presses `Backspace`, **Then** Cacablu performs the same deletion and prevents the browser default.
3. **Given** multiple existing bars are selected, **When** either deletion key is pressed, **Then** Cacablu removes all selected bars as one operation and leaves unrelated bars unchanged.
4. **Given** the selection is empty, stale, or contains no existing bar, **When** either deletion key is pressed, **Then** Cacablu performs no bar mutation and creates no Undo entry.
5. **Given** focus is in an input, textarea, select, contenteditable element, ARIA textbox, or Monaco editor, **When** either deletion key is pressed, **Then** the focused editor retains its native behavior and no timeline bar is deleted.
6. **Given** another handler has already consumed the key event, **When** global keyboard routing receives it, **Then** Cacablu does not execute the bar deletion command again.

---

### User Story 2 - Undo Bar Deletion (Priority: P1)

As a timeline editor, I want deletion to be undoable so that an accidental keypress does not permanently destroy bar configuration.

**Why this priority**: Destructive keyboard editing is only safe when the complete affected state can be recovered.

**Independent Test**: Delete one or multiple fully configured bars, invoke Edit > Undo, and verify their stable ids, all fields, layer placement, intervals, and selection are restored.

**Acceptance Scenarios**:

1. **Given** one bar was deleted, **When** the user invokes Undo, **Then** Cacablu restores the bar with its original stable id and every persisted field.
2. **Given** multiple bars were deleted together, **When** the user invokes Undo, **Then** Cacablu restores all of them atomically as one Undo action.
3. **Given** Undo succeeds, **When** Timeline refreshes, **Then** every restored bar is selected again.
4. **Given** any restored id conflicts or a database insert fails, **When** Undo runs, **Then** no partial set is restored and the existing Undo error flow reports the failure.

---

### User Story 3 - Keep Phoenix Aligned (Priority: P2)

As a user previewing the project in Phoenix, I want deletion and Undo reflected in the running engine so that runtime sections match the Cacablu project.

**Why this priority**: The local project is authoritative, but a connected preview must converge without requiring a full project reload.

**Independent Test**: With Phoenix connected, delete selected bars and Undo immediately; verify one many-section delete precedes single-section restoration and unrelated sections are untouched.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected, **When** local deletion commits, **Then** Cacablu sends all deleted stable ids in one existing `deleteMany` request.
2. **Given** Phoenix accepts deletion, **When** it applies the request, **Then** it removes the matching runtime sections and editor-owned root `.spo` files without changing unrelated sections.
3. **Given** Phoenix is connected, **When** Undo restores bars, **Then** Cacablu republishes every restored bar eligible under current section publication rules.
4. **Given** a restored bar is disabled or otherwise excluded by publication rules, **When** Undo synchronizes, **Then** Cacablu keeps it locally and does not send a section update.
5. **Given** deletion is still in flight, **When** Undo starts, **Then** restoration synchronization waits for deletion synchronization so Phoenix finishes in the restored state.
6. **Given** Phoenix is disconnected, **When** deletion or Undo commits, **Then** local state remains committed and Cacablu sends no request or synthetic disconnected error.
7. **Given** a connected Phoenix request fails, **When** deletion or Undo has already committed locally, **Then** local state remains authoritative and Cacablu records affected ids through Events and section-error state.

### Edge Cases

- The selection contains duplicated or stale ids.
- The Timeline panel is closed when the global keyboard command runs.
- A stable id is reused before Undo attempts restoration.
- Phoenix disconnects between local commit and network synchronization.
- The user invokes Undo before the asynchronous Phoenix deletion response arrives.
- A selected bar is disabled, unconfigured, or invalid for Phoenix publication.
- A multi-bar database operation fails after validation.

## Requirements

### Functional Requirements

- **FR-001**: Cacablu MUST route unmodified `Delete` and `Backspace` keypresses to one shared selected-bar deletion command.
- **FR-002**: The shared command MUST resolve existing bars from both single- and multi-bar resource selection and MUST ignore stale ids.
- **FR-003**: Cacablu MUST NOT run bar deletion when the event is already handled or its target is an editable browser or Monaco control.
- **FR-004**: Cacablu MUST prevent the browser default only when an application deletion command consumes the keypress.
- **FR-005**: One command MUST delete every selected existing bar and no unrelated bar.
- **FR-006**: Multi-bar deletion MUST be atomic in the project database and MUST update in-memory project state only after the database mutation succeeds.
- **FR-007**: Successful deletion MUST clear deleted resource selection and emit one Timeline refresh.
- **FR-008**: Successful deletion MUST create exactly one Undo entry containing immutable complete bar snapshots.
- **FR-009**: Undo MUST restore original stable ids, names, types, layers, times, enabled and selected flags, scripts, blend metadata, and alpha metadata.
- **FR-010**: Multi-bar restoration MUST use one database transaction and MUST roll back completely on conflict or insert failure.
- **FR-011**: Successful Undo MUST refresh Timeline once and reselect all restored bars.
- **FR-012**: When Phoenix is connected, deletion MUST call the existing many-section delete API once with all deleted ids.
- **FR-013**: When Phoenix is connected, Undo MUST use the existing single-section synchronization path for every restored publication-eligible bar.
- **FR-014**: Undo synchronization MUST wait for any in-flight synchronization of the deletion it reverses.
- **FR-015**: When Phoenix is disconnected, local deletion and Undo MUST succeed without network requests or disconnected-sync errors.
- **FR-016**: Connected synchronization failure MUST NOT roll back local state and MUST identify affected bar ids in the existing diagnostic flow.
- **FR-017**: The feature MUST introduce no SQLite schema change, new Phoenix endpoint, backend, or runtime dependency.
- **FR-018**: Saved and reopened project data MUST preserve deletion or restored state according to the latest local operation.

### Key Entities

- **Bar Deletion Snapshot**: Immutable copy of every persisted field for one deleted timeline bar.
- **Bar Deletion Command**: One local operation containing the resolved selected bars, their snapshots, their stable ids, and the corresponding Undo action.
- **Bar Restoration Transaction**: Atomic insertion of every snapshot from one deletion command with original stable ids.
- **Phoenix Deletion Synchronization**: One `deleteMany` request containing all ids committed by the local command.
- **Phoenix Restoration Synchronization**: Ordered single-section publication of restored bars eligible for Phoenix.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Automated tests cover both deletion keys, editable focus guards, empty/stale selection, single selection, and multi-selection.
- **SC-002**: A delete/Undo round trip restores 100% of persisted fields and stable ids for every affected bar.
- **SC-003**: A conflicting multi-bar restoration leaves zero partially restored rows.
- **SC-004**: Connected multi-bar deletion emits exactly one Phoenix delete request containing all affected ids.
- **SC-005**: Immediate Undo always leaves Phoenix restoration ordered after deletion completion.
- **SC-006**: Disconnected deletion and Undo emit zero Phoenix requests and zero synthetic disconnected errors.
- **SC-007**: The complete Cacablu unit suite and typecheck pass with no regression from this feature.
- **SC-008**: Cacablu production build and Phoenix Debug build complete successfully.

## Assumptions

- The loaded Cacablu `DbSession` remains the source of truth.
- Existing Undo manager behavior retains a failed Undo entry for a later retry.
- Existing Phoenix section delete/update APIs remain stable.
- Reconnect or project synchronization can reconcile a connected sync failure later.
- Redo is outside this feature because the current shared Undo manager exposes Undo only.
