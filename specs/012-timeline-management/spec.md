# Feature Specification: Timeline Management

**Feature Branch**: `012-timeline-management`  
**Created**: 2026-07-02  
**Status**: Draft  
**Input**: User description: "Continuar con una nueva spec sobre timeline management. La timeline debe permitir gestionar bars desde Cacablu y sincronizarlas con Phoenix."

## Runtime Context *(mandatory)*

**Browser Surface**: The Cacablu Timeline panel, Inspector panel, Events panel, top-level project shell, and project database save/open workflow.  
**Local Engine Dependency**: Phoenix is optional for local editing. When connected in slave mode, committed timeline edits are synchronized to Phoenix through the existing section sync API.  
**Static Deployment Impact**: Cacablu remains a static browser app with no backend; it uses the loaded SQLite project session, browser UI events, `fetch`, and `WebSocket`.  
**Real-Time Sensitivity**: Drag, resize, zoom, and selection must remain responsive. Phoenix synchronization must be debounced and must not block pointer interactions.  
**File System Access Requirement**: Requires File System Access API for opening and saving project SQLite files. The Timeline panel itself can open empty without a project.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load And Display Project Bars (Priority: P1)

As a user, I want the Timeline to be empty before a project is loaded and then show the bars from the opened project so that the visible timeline represents the project database.

**Why this priority**: This is the baseline for timeline management; editing is unsafe if the displayed bars are not the actual project bars.

**Independent Test**: Open Cacablu with no project, open Timeline, then load a known SQLite project and verify clips match project bars by id, type, layer, start, and end.

**Acceptance Scenarios**:

1. **Given** no project is loaded, **When** the user opens Timeline, **Then** Cacablu shows an empty timeline with no default bars or default layers.
2. **Given** a project is loaded, **When** Timeline renders, **Then** Cacablu shows one clip per database bar.
3. **Given** the project has bars on multiple layers, **When** Timeline renders, **Then** Cacablu creates only the layers required by those bars.
4. **Given** a project is opened before the Timeline panel is mounted, **When** Cacablu opens the Timeline panel, **Then** the panel immediately loads bars from the already-open project session.

---

### User Story 2 - Select And Edit Timeline Bar Sections (Priority: P1)

As a user, I want to select a bar on the Timeline and edit its section script and blend settings so that I can change the Phoenix section represented by that bar.

**Why this priority**: Selection is required before safe editing, deletion, and Bar Editor integration.

**Independent Test**: Load a project, select a timeline bar, verify Bar Editor opens on the right with that bar's script and blend settings; click empty timeline space and verify selection clears.

**Acceptance Scenarios**:

1. **Given** a project is loaded, **When** the user single-clicks a timeline bar, **Then** Cacablu records the selected bar id and opens or updates Bar Editor on the right side, even when the same bar was already selected.
2. **Given** a timeline bar is selected, **When** the user clicks empty timeline space, **Then** Cacablu clears the selected bar.
3. **Given** a selected bar is deleted, **When** deletion completes, **Then** Cacablu clears selection and Bar Editor no longer shows stale bar data.
4. **Given** a timeline bar is selected, **When** the user edits script or blend fields and applies them, **Then** Cacablu persists those values to the loaded project session.
5. **Given** Bar Editor is open for a selected bar, **When** it renders, **Then** it shows Bar Type, Script Template, Save Template, code editor, Blend Source, Blend Destination, Blend Equation, and Apply controls.
6. **Given** Timeline is visible, **When** the user toggles Bars > Display IDs, **Then** each bar label shows its id before the name separated by one space, and the menu changes to Ocultar IDs until toggled off.
7. **Given** Bar Editor's Monaco code editor opens suggest lists, context menus, or hover widgets, **When** those popups overlap the timeline area, **Then** they render above every docked workspace panel and are not clipped by the timeline or Dockview layout.
8. **Given** a selected bar has section errors in Phoenix, **When** the user edits its script and presses Apply, **Then** Cacablu keeps the edited script in the project session even if Phoenix still rejects the section.
9. **Given** a selected bar has edited time fields that are invalid, **When** the user presses Apply, **Then** Cacablu keeps the prior time range but still persists valid non-time fields such as name, type, script, and blend metadata.

---

### User Story 3 - Edit Bars From Timeline (Priority: P1)

As a user, I want to create, move, resize, change layer, and delete bars from the Timeline so that Cacablu can become the primary timeline editor.

**Why this priority**: Timeline management is primarily an editing workflow, not only display.

**Independent Test**: Load a project copy, perform create/move/resize/layer/delete operations, save, reopen, and confirm the SQLite database contains the edited bars.

**Acceptance Scenarios**:

1. **Given** a project is loaded, **When** the user creates a bar on the timeline, **Then** Cacablu creates a database bar with a stable id and visible clip.
2. **Given** a bar exists, **When** the user drags it horizontally, **Then** Cacablu updates its start and end times.
3. **Given** a selected bar exists, **When** the user drags it without overlapping another bar, **Then** Cacablu updates its start time, end time, and layer.
4. **Given** a selected bar is being dragged, **When** the requested position would overlap another bar on the same layer, **Then** Cacablu blocks that position and does not persist an overlapping edit.
5. **Given** a bar move was committed, **When** the user chooses Edit > Undo, **Then** Cacablu restores the bar's previous start time, end time, and layer using the undo action stack.
6. **Given** a bar exists, **When** the user resizes its start or end edge, **Then** Cacablu updates the corresponding time while preserving positive duration.
7. **Given** a bar is selected, **When** the user deletes it, **Then** Cacablu removes it from the project database and the timeline.

---

### User Story 4 - Sync Edited Bars To Phoenix (Priority: P2)

As a user, I want timeline edits to be sent to Phoenix when the engine is connected so that the preview follows the edited project timeline.

**Why this priority**: Phoenix must reflect editor changes, but local editing should remain useful without Phoenix.

**Independent Test**: Connect Phoenix, edit a bar, and verify Cacablu sends debounced section sync. Disconnect Phoenix, edit another bar, and verify local edit persists with a non-blocking event.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected, **When** the user commits a timeline edit, **Then** Cacablu schedules a debounced project bar section sync.
2. **Given** multiple edits happen quickly, **When** the debounce window closes, **Then** Cacablu sends the latest complete bar snapshot once.
3. **Given** Phoenix is disconnected, **When** the user commits a timeline edit, **Then** Cacablu keeps the local edit and does not attempt a Phoenix request.
4. **Given** Phoenix rejects section sync, **When** Cacablu receives the response, **Then** Cacablu records Events with affected bar ids when available.
5. **Given** Phoenix section sync reports errors for known bars, **When** Timeline renders, **Then** the affected timeline bars are shown in red until those bar ids are cleared by successful resync or project reset.
6. **Given** Cacablu is preparing or checking section sync, **When** it can count real local work, **Then** the sync modal advances its progress text and bar using actual processed counts, not synthetic animation.
7. **Given** Phoenix is connected, **When** a bar move is committed, **Then** Cacablu schedules only the updated bar section for Phoenix so Phoenix rewrites the corresponding `.spo` file.
8. **Given** a bar move was just committed while playback is stopped, **When** the user immediately presses Play, **Then** transport commands take priority over the deferred section sync.
9. **Given** Phoenix is not connected, **When** the user opens a project, **Then** Cacablu MUST NOT start the initial Phoenix sync step.
10. **Given** a project is loaded while Phoenix is disconnected, **When** Phoenix later connects, **Then** Cacablu asks the user whether to load the pending project into Phoenix instead of logging disconnected sync errors.

---

### User Story 5 - Preserve Transport Usability (Priority: P3)

As a user, I want transport controls to remain visible and understandable whether or not Phoenix is connected so that Timeline stays useful as an editor panel.

**Why this priority**: Transport is important, but bar editing can proceed without runtime playback.

**Independent Test**: Open Timeline with Phoenix disconnected and verify the panel remains open, editing remains possible, and Phoenix-only transport actions are disabled or no-op.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected, **When** the user uses transport controls, **Then** Cacablu sends the matching runtime command and follows Phoenix runtime state.
2. **Given** Phoenix is disconnected, **When** the Timeline panel is open, **Then** Cacablu keeps the panel open and communicates disconnected transport state without blocking editing.
3. **Given** the timeline starts playing, **When** the playhead advances, **Then** the current-time line glow trail grows gradually.
4. **Given** playback stops, **When** the playhead is no longer advancing, **Then** the trail fades away gradually and only a subtle glow remains on the line.

---

### User Story 6 - Draw On An Implicit Layer Surface (Priority: P1)

As a user, I want unused timeline rows to behave as available layers so that I can create bars anywhere on the visible surface without first creating or persisting an empty layer.

**Why this priority**: Layer creation is unnecessary when a bar's numeric layer already defines the occupied layer.

**Independent Test**: Scroll below the last occupied layer, drag a bar on an unused row, and verify a further full window of unused rows and aligned grid lines remains below it.

**Acceptance Scenarios**:

1. **Given** visible empty rows, **When** the user drags across an unoccupied interval on any row, **Then** Cacablu creates a bar using that row's numeric layer without a New Layer command.
2. **Given** a last occupied layer, **When** Timeline lays out or resizes, **Then** at least one full visible window of unused layers remains below it.
3. **Given** the user creates a bar in the unused window, **When** the last occupied layer changes, **Then** the extension point moves so a further full unused window remains available.
4. **Given** vertical scrolling below initial content, **When** unused layers are visible, **Then** vertical time-grid lines remain aligned with the ruler and bars.
5. **Given** the application menu bar, **When** timeline commands render, **Then** they appear under `Timeline`, not the former `Bars` label.

### Edge Cases

- What happens when a drag would move a bar before time zero?
- What happens when a drag would overlap another bar on the same layer?
- What happens when a resize would create zero or negative duration?
- What happens when Phoenix disconnects during debounced section sync?
- What happens when a selected bar is deleted by another operation before Inspector renders?
- What happens when a project has zero bars?
- What happens when a bar has unsupported type or malformed script and Phoenix rejects it?
- What happens when a save fails after timeline edits have been applied in memory?
- What happens when Bar Editor is opened without a project or without a selected bar?
- What happens when a stored blend equation uses a legacy OpenGL-style value?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Timeline panel MUST open even when no project is loaded.
- **FR-002**: With no loaded project, Timeline MUST show no default bars and no default layers.
- **FR-003**: When a project is loaded, Timeline MUST render clips from database bars only.
- **FR-004**: Each rendered clip MUST preserve the bar id, type, layer, start time, and end time.
- **FR-005**: Users MUST be able to select a bar from Timeline.
- **FR-006**: Timeline selection MUST be reflected in shared app selection state.
- **FR-007**: Bar Editor MUST open on the right when a timeline bar is single-clicked, including repeated clicks on the same selected bar.
- **FR-008**: Users MUST be able to clear timeline bar selection by selecting empty timeline space.
- **FR-009**: Users MUST be able to create a bar from Timeline.
- **FR-010**: Users MUST be able to move a bar in time.
- **FR-011**: Users MUST be able to move a bar to another layer.
- **FR-012**: Users MUST be able to resize a bar start or end.
- **FR-013**: Users MUST be able to delete a selected bar.
- **FR-014**: Timeline edits MUST persist to the loaded project session.
- **FR-015**: Timeline edits MUST be represented in the saved SQLite file after Save.
- **FR-016**: The system MUST reject or clamp edits that would produce negative times.
- **FR-017**: The system MUST reject or clamp edits that would produce zero or negative duration.
- **FR-017a**: The system MUST prevent moved timeline bars from overlapping other bars on the same layer.
- **FR-017b**: Bar move edits MUST push undoable actions onto an action stack using a command-style undo pattern.
- **FR-018**: Committed timeline edits MUST schedule Phoenix section synchronization when Phoenix is connected.
- **FR-019**: Section synchronization after timeline edits MUST be debounced.
- **FR-020**: Cacablu MUST keep local timeline edits if Phoenix is disconnected or rejects sync.
- **FR-020a**: Cacablu MUST skip initial project sync entirely when Phoenix is not connected.
- **FR-020b**: If Phoenix connects after a project was opened without sync, Cacablu MUST prompt the user before loading that project into Phoenix.
- **FR-021**: Cacablu MUST record sync failures in Events.
- **FR-022**: Cacablu MUST include affected bar ids in Events when they are known.
- **FR-022a**: Timeline bars with known Phoenix section sync errors MUST be visually marked in red based on tracked failed bar ids, even if the Events panel is rerendered or compacted.
- **FR-023**: Timeline transport controls MUST remain visible when Timeline is open.
- **FR-024**: Transport actions that require Phoenix MUST be disabled or no-op with clear disconnected state when Phoenix is disconnected.
- **FR-025**: The feature MUST preserve Cacablu's static browser-only deployment model.
- **FR-026**: The feature MUST use existing Phoenix editor API section sync rather than the legacy raw TCP protocol.
- **FR-027**: Bar Editor MUST provide a Bar Type selector, Script Template selector, Save Template button, code editing field, Blend Source selector, Blend Destination selector, Blend Equation selector, and Apply button.
- **FR-028**: Bar Editor Apply MUST update the selected bar name, type, script, start time, end time, source blend, destination blend, and blend equation in the loaded project session.
- **FR-028a**: Bar Editor Apply MUST keep valid non-time edits when edited time fields are invalid, preserving the prior valid time range.
- **FR-028b**: Bar Editor Apply MUST persist edits locally before Phoenix synchronization and MUST keep those local edits even when Phoenix reports section load errors.
- **FR-029**: Blend Equation MUST present the user-facing values `Add`, `Subtract`, and `Reverse subtract`, while storing Phoenix-compatible values.
- **FR-030**: The sync modal MUST only show count progress when backed by real processed units, including section manifest checking; one-shot Phoenix requests MUST not display stale `0/N` counters or reset the bar to zero.
- **FR-031**: The Events panel MUST use compact text sizing suitable for dense diagnostic messages.
- **FR-032**: The playhead MUST grow its glow trail gradually when playback starts and fade the trail away gradually when playback stops.
- **FR-033**: Bars menu MUST provide `Display IDs`; when enabled, timeline bar labels MUST show `<id> <name>` and the menu item MUST become `Ocultar IDs`.
- **FR-034**: A committed bar move MUST update the project session and notify Phoenix through deferred single-section sync so Phoenix rewrites only the affected `.spo` file without blocking immediate transport commands.
- **FR-035**: Edit > Undo MUST pop the latest undoable action and restore the affected bar move when possible.
- **FR-036**: The Bar Editor Monaco editor MUST render overflow widgets, including suggest lists, hover widgets, and context menus, above the timeline and other docked panels without clipping or stacking behind them.
- **FR-037**: Bar Editor Monaco overflow behavior MUST be validated with Playwright or equivalent browser automation when changed.
- **FR-038**: Timeline MUST treat visible empty rows as implicit numeric layers without storing empty-layer entities.
- **FR-039**: Timeline MUST provide at least one full panel-height window of unused layers below the last occupied layer.
- **FR-040**: The unused-layer extension MUST advance whenever a new last occupied layer is created.
- **FR-041**: Vertical time-grid lines MUST continue through all currently visible scrolled layers and remain ruler-aligned.
- **FR-042**: Timeline-specific commands MUST appear under a top-level menu named `Timeline`, with no separate New Layer command.

### Key Entities *(include if feature involves data)*

- **Timeline Bar**: The editable visual representation of a project database bar, including id, type, layer, start time, end time, enabled state, blend metadata, and script.
- **Timeline Selection**: The current selected timeline bar id or empty selection state shared with Inspector.
- **Bar Editor**: The right-side panel for editing a selected bar's type/template, script, blend source, blend destination, and blend equation.
- **Monaco Overflow Widget**: A Monaco-owned popup such as the suggest list, hover widget, or context menu that must escape dock-panel clipping and remain topmost while editing code.
- **Timeline Edit Transaction**: A create, move, resize, layer change, property edit, or delete operation applied to the project database.
- **Section Sync Request**: A debounced request that serializes all current project bars and asks Phoenix to align runtime sections.
- **Timeline Sync Event**: A non-blocking Event row that reports validation or Phoenix section sync failures when a network sync was actually attempted.
- **Section Error State**: The tracked set of bar ids whose latest Phoenix section sync or asset impact response failed or deactivated runtime execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening Timeline without a project shows zero bars and zero default layers.
- **SC-002**: Loading a known project renders 100% of database bars with matching ids, timing, and layers.
- **SC-003**: Create, move, resize, layer change, and delete operations persist after save and reopen in manual validation.
- **SC-004**: Invalid negative-time and non-positive-duration edits are not persisted.
- **SC-005**: With Phoenix connected, committed timeline edits trigger one debounced section sync per edit burst.
- **SC-006**: With Phoenix disconnected, committed timeline edits remain local and produce an Event.
- **SC-007**: Phoenix section sync failures are visible in Events and identify affected bar ids when available.
- **SC-008**: `npm test`, `npm run typecheck`, and `npm run build` complete without new errors after implementation.
- **SC-009**: Bar Editor opens from a single click and applies script/blend changes to the active project session.
- **SC-010**: Timeline bars with section sync errors are visibly red and return to normal after the affected bars successfully resync or section error state is reset.
- **SC-011**: Browser automation confirms Monaco popups opened from Bar Editor are the top element at their screen position and do not appear behind the timeline.
- **SC-012**: Opening a project before Timeline mounts still renders all project bars when the Timeline panel is opened.
- **SC-013**: A bar can be created on any visible unused row while one full unused window remains below the resulting last occupied layer.
- **SC-014**: Grid lines remain visible and aligned throughout vertical layer scrolling.

## Assumptions

- The current SQLite schema can represent the required bar edits.
- The existing project section sync service remains the correct pathway for sending bars to Phoenix.
- The first implementation does not need multi-select editing.
- Exact gesture choices for creation can be toolbar, context menu, double click, or a combination decided during implementation.
