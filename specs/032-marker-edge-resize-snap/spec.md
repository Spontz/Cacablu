# Feature Specification: Snap Bar Edges To Timeline Markers

**Feature Branch**: `032-marker-edge-resize-snap`  
**Created**: 2026-08-22  
**Status**: Draft  
**Input**: User description: "Mientras se redimensionan una o más barras desde sus bordes, mantener Shift debe ajustar el inicio o final a los markers de la Timeline."

## Runtime Context

**Browser Surface**: Timeline bar start/end resize handles and Timeline markers.  
**Project Dependency**: A loaded project containing at least one bar and one enabled marker.  
**Phoenix Dependency**: None for preview or local commit; the existing deferred section synchronization remains applicable after a successful commit.  
**Real-Time Sensitivity**: Snap preview must follow pointer and modifier-key changes without interrupting pointer capture or causing visible jumps unrelated to a marker.  
**Persistence Impact**: Only committed bar start/end times change; markers and application preferences remain unchanged.

## User Scenarios & Testing

### User Story 1 - Snap One Bar Edge To A Marker (Priority: P1)

As a Timeline editor, I want an edge being resized to snap to a nearby marker while I hold `Shift` so that a section can begin or end at an exact authored cue without manually entering its time.

**Why this priority**: Exact alignment between section boundaries and authored markers is the core purpose of this feature.

**Independent Test**: Resize a bar's start and end handles near enabled markers, press `Shift` during each active gesture, and verify that the preview and committed endpoint equal the selected marker time exactly.

**Acceptance Scenarios**:

1. **Given** a bar start edge is being resized and an enabled marker is within the snap threshold, **When** the user holds `Shift`, **Then** the previewed start time becomes exactly that marker's time while the end time remains unchanged.
2. **Given** a bar end edge is being resized and an enabled marker is within the snap threshold, **When** the user holds `Shift`, **Then** the previewed end time becomes exactly that marker's time while the start time remains unchanged.
3. **Given** an edge-resize gesture is already active and the pointer is stationary near a marker, **When** the user presses `Shift`, **Then** snap activates immediately without requiring further pointer movement.
4. **Given** an edge is snapped during resize, **When** the pointer is released while `Shift` remains held, **Then** the exact marker time is persisted as one normal resize edit.
5. **Given** `Shift` is not held during an edge resize, **When** the pointer moves near or across a marker, **Then** existing free-resize behavior remains unchanged.

---

### User Story 2 - Snap Multiple Bar Edges Atomically (Priority: P1)

As an editor working with multiple selected bars, I want their corresponding resized edges to snap to one marker together so that several sections can share an exact start or end cue.

**Why this priority**: Multi-selection must provide the same precise alignment benefit without repetitive per-bar edits or partial results.

**Independent Test**: Select multiple bars with different durations, resize their start edges and then their end edges with `Shift`, and verify that every corresponding endpoint equals the same marker while every opposite endpoint is preserved.

**Acceptance Scenarios**:

1. **Given** multiple bars participate in a start-edge resize, **When** `Shift` snap selects a marker, **Then** every affected bar receives that exact marker time as its proposed start and retains its individual end time.
2. **Given** multiple bars participate in an end-edge resize, **When** `Shift` snap selects a marker, **Then** every affected bar receives that exact marker time as its proposed end and retains its individual start time.
3. **Given** a snapped multi-bar proposal would make any duration invalid or create any prohibited same-layer overlap, **When** the user releases the pointer, **Then** the complete resize is rejected without partial mutation, Undo entry, or Phoenix synchronization.
4. **Given** a snapped multi-bar proposal is valid, **When** the user releases the pointer, **Then** all affected bars commit atomically and one Undo restores every prior endpoint.

---

### User Story 3 - Understand And Control The Snap Target (Priority: P2)

As an editor, I want clear feedback about which marker owns the snap and the ability to disengage it during the same gesture so that precise resizing remains predictable.

**Independent Test**: Resize near multiple markers while pressing and releasing `Shift`; verify deterministic target selection, visible feedback, and immediate return to the unsnapped pointer-derived preview.

**Acceptance Scenarios**:

1. **Given** multiple enabled markers fall within the snap threshold, **When** snap is active, **Then** Cacablu chooses the marker closest to the pointer-derived endpoint time.
2. **Given** two eligible markers are equally close, **When** snap is resolved, **Then** Cacablu chooses the earlier marker time, using the lower marker id only if their times are also equal.
3. **Given** an edge is snapped, **When** the user releases `Shift` before pointer-up, **Then** snap disengages immediately and the preview returns to the current pointer-derived free-resize time.
4. **Given** snap is active on a marker, **When** Timeline renders the resize preview, **Then** the target marker and snapped edge have a visible snap indication that does not rely only on color.
5. **Given** no eligible marker is within the snap threshold, **When** `Shift` is held during edge resize, **Then** the resize continues at its unsnapped pointer-derived time.

## Edge Cases

- `Shift` is already held before pointer-down on a resize handle.
- `Shift` is pressed or released without any subsequent pointer movement.
- The nearest marker is disabled, has a non-finite time, or lies outside the editable Timeline bounds.
- Several enabled markers share the same timestamp.
- The marker is at time zero or at the current project duration boundary.
- Snapping the start edge would meet or cross one affected bar's end edge.
- Snapping the end edge would meet or cross one affected bar's start edge.
- A valid endpoint for one selected bar is invalid or overlapping for another selected bar.
- Zoom changes the time represented by the fixed screen-space snap threshold.
- Marker state changes or the target marker disappears during an active resize.
- Pointer capture is lost while an edge is snapped.
- `Shift` is used while dragging the body of a bar rather than a resize handle; existing layer-only drag behavior must remain authoritative.

## Requirements

### Functional Requirements

- **FR-001**: Marker snap MUST be available only during an active Timeline bar start-edge or end-edge resize gesture.
- **FR-002**: Holding `Shift` during an eligible resize MUST enable marker snap, whether `Shift` was held before pointer-down or pressed after the gesture began.
- **FR-003**: Pressing or releasing `Shift` during an active resize MUST recompute the preview immediately without requiring additional pointer movement.
- **FR-004**: Cacablu MUST consider only enabled markers with finite times inside the editable Timeline bounds as snap candidates.
- **FR-005**: A marker MUST be eligible when its rendered horizontal position is no more than 10 CSS pixels from the pointer-derived endpoint position; this screen-space threshold MUST remain constant across Timeline zoom levels.
- **FR-006**: When one or more markers are eligible, Cacablu MUST choose the smallest screen-space distance, then the earlier time, then the lower marker id.
- **FR-007**: A snapped endpoint MUST use the marker's stored time exactly and MUST NOT use a rounded pointer-derived approximation.
- **FR-008**: Start-edge snap MUST preserve each affected bar's end time, and end-edge snap MUST preserve each affected bar's start time.
- **FR-009**: In a multi-bar edge resize, the chosen marker time MUST be proposed for the corresponding endpoint of every affected bar.
- **FR-010**: Resize preview, Bar Editor aggregate timing, and any visible timing label MUST reflect the snapped proposal before persistence.
- **FR-011**: The active snap target and snapped edge MUST have a visible indicator that includes a non-color-only cue such as a guide, glyph, or emphasized geometry.
- **FR-012**: Releasing `Shift` before pointer-up MUST remove the snap target and restore the preview calculated from the current pointer position.
- **FR-013**: Holding `Shift` with no eligible marker MUST preserve free-resize behavior and MUST NOT jump to a distant marker.
- **FR-014**: Every snapped proposal MUST pass the existing positive-duration, non-negative-time, Timeline-bound, and same-layer overlap validation before commit.
- **FR-015**: Multi-bar validation and commit MUST be atomic: if any affected bar is invalid, no affected bar may be persisted.
- **FR-016**: A successful snapped resize MUST create one Undo transaction containing complete prior snapshots for all affected bars and MUST schedule Phoenix synchronization only after the local transaction commits.
- **FR-017**: A cancelled gesture, lost pointer capture, invalid release, or vanished target marker MUST leave persisted bar and marker data unchanged.
- **FR-018**: Snap MUST NOT modify, select, move, enable, disable, or otherwise mutate the target marker.
- **FR-019**: Existing `Shift` behavior for bar-body dragging and Shift-click selection MUST remain unchanged; marker snap MUST NOT activate unless the gesture began from a resize edge.
- **FR-020**: Pointer handling and snap computation MUST remain responsive and MUST NOT perform persistence or Phoenix synchronization during pointer movement or modifier-key changes.

## Key Entities

- **Resize Set**: The one or more selected bars whose corresponding start or end endpoint participates in the active resize gesture.
- **Pointer-Derived Endpoint**: The unsnapped candidate time calculated from the current pointer position using existing Timeline resize behavior.
- **Snap Candidate**: An enabled, finite, in-bounds marker whose rendered position is within the snap threshold of the pointer-derived endpoint.
- **Snap Target**: The deterministically selected candidate whose exact stored time is applied to the resize set preview.
- **Snapped Resize Proposal**: The complete set of proposed bar placements after assigning the snap target time and before atomic validation and persistence.
- **Snap Indicator**: The temporary visual relationship between the active bar edge and target marker during an eligible resize.

## Success Criteria

- **SC-001**: Automated tests prove start and end edges commit exactly the selected marker timestamp, including marker times with three decimal places.
- **SC-002**: Automated tests prove `Shift` keydown and keyup update a stationary active resize preview without another pointermove event.
- **SC-003**: Tests at multiple zoom levels prove eligibility remains 10 CSS pixels while the corresponding time range changes with scale.
- **SC-004**: Multi-bar tests prove every corresponding endpoint receives one marker time, every opposite endpoint is preserved, and Undo restores all original values as one action.
- **SC-005**: Invalid-duration and overlap tests prove an invalid member causes zero partial persistence, zero Undo entries, and zero Phoenix requests.
- **SC-006**: Determinism tests prove nearest-distance, earlier-time, and lower-id target ordering.
- **SC-007**: Real-browser validation demonstrates visible snap feedback and confirms free resize resumes immediately when `Shift` is released.
- **SC-008**: Regression tests prove Shift-click selection and `Shift` bar-body layer-only dragging retain their existing behavior.
- **SC-009**: Typecheck, focused unit tests, complete unit tests, changed-file lint, real-browser validation, and the production build complete without new errors.

## Assumptions

- "Dragging by the edges" means an existing start-edge or end-edge resize gesture, not movement of the complete bar body.
- Multi-bar edge resize aligns the same endpoint of every affected bar to one common marker time rather than preserving relative offsets between those endpoints.
- Disabled markers are intentionally excluded because they do not represent active Timeline cues.
- The fixed 10 CSS-pixel threshold provides a predictable magnetic target independent of Timeline zoom.
- Existing Timeline placement validation, Undo management, Bar Editor preview, and deferred Phoenix synchronization remain the authoritative downstream behaviors.
