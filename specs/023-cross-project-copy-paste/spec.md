# Feature Specification: Cross-Project Copy And Paste

**Feature Branch**: `023-cross-project-copy-paste`  
**Created**: 2026-07-20  
**Status**: Closed  
**Closed**: 2026-07-20  
**Input**: User description: "Necesito poder copiar y pegar entre dos pestañas que tengan dos proyectos diferentes cargados barras con sus propiedades y carpetas y archivos del filesystem. En Timeline, el tiempo y la capa seleccionados determinan el punto de pegado; en Filesystem debe funcionar como un copy/paste normal."

## Runtime Context

**Browser Surface**: Two or more Cacablu browser tabs, Timeline lanes/ruler/playhead, shared Edit Copy/Paste commands, Pool Resources panel, Undo, and Events.  
**Local Engine Dependency**: Optional. Copy and local paste work without Phoenix. When connected, pasted bars and Pool resources use the existing scoped section and asset synchronization paths.  
**Static Deployment Impact**: Cacablu remains a browser-only static application. Cross-tab transfer uses the browser/system clipboard and MUST NOT require a backend, cloud service, native host, or shared server process.  
**Real-Time Sensitivity**: Selecting a Timeline paste target and committing a local paste must feel immediate. Clipboard serialization, validation, database mutation, and optional Phoenix synchronization must not make pointer interaction or Timeline rendering unresponsive.  
**File System Access Requirement**: Each tab uses the existing File System Access workflow to open and save its own project. Pool copy/paste transfers project database resource contents and metadata; it does not copy arbitrary operating-system files outside the loaded project.

## User Scenarios & Testing

### User Story 1 - Copy Bars Between Projects (Priority: P1)

As an editor with different projects open in separate tabs, I want to copy selected Timeline bars from one project and paste them into another project with all their properties intact.

**Why this priority**: Cross-project bar reuse is the primary requested workflow and cannot depend on source-tab memory or shared database ids.

**Independent Test**: Open project A and project B in separate tabs, copy one or multiple configured bars in A, close or leave A, paste in B, and verify the destination creates independent bars with equivalent properties.

**Acceptance Scenarios**:

1. **Given** one Timeline bar is selected in project A, **When** the user invokes Copy, **Then** Cacablu writes a self-contained, versioned bar payload to the browser/system clipboard.
2. **Given** multiple bars are selected, **When** the user invokes Copy, **Then** the payload contains every selected existing bar exactly once and preserves their relative time and layer arrangement.
3. **Given** a valid bar payload copied in project A, **When** project B pastes it into Timeline, **Then** project B creates new destination ids and preserves each bar's name, type, duration, enabled state, script, blend values, blend equation, and alpha metadata.
4. **Given** the source project or tab is later closed or changed, **When** the destination pastes the copied payload, **Then** paste remains possible because the clipboard snapshot does not depend on source session memory.
5. **Given** bar Copy is invoked, **When** the clipboard also exposes plain text, **Then** the application-specific payload remains distinguishable from ordinary text and does not cause arbitrary text to be interpreted as project data.

---

### User Story 2 - Select The Timeline Paste Point (Priority: P1)

As an editor, I want an explicit selected Timeline layer combined with the selected current time so pasted bars appear at the exact time/layer point I chose.

**Why this priority**: A paste operation is ambiguous without both coordinates, and Timeline currently has no persistent selected-layer concept.

**Independent Test**: Click a lane at a known time, verify that layer and time are visibly selected, then paste a multi-layer group and confirm its earliest start and lowest source layer align with that target.

**Acceptance Scenarios**:

1. **Given** the user performs a simple primary click on a Timeline lane, **When** the click is not a drag, box selection, resize, or bar-creation gesture, **Then** Cacablu selects that lane's numeric layer and sets the current Timeline time from the horizontal click position.
2. **Given** a Timeline layer is selected, **When** the current time changes through ruler click, scrubbing, seeking, or transport, **Then** the selected layer remains selected and the paste target time follows the current time.
3. **Given** a selected layer, **When** Timeline renders or scrolls, **Then** the selected lane has a persistent visual highlight and the current time remains visible through the existing playhead/paste-time indicator.
4. **Given** the project, Timeline instance, or active project session changes, **When** no layer has yet been selected in that destination session, **Then** bar Paste is unavailable and Cacablu tells the user to select a Timeline layer.
5. **Given** copied bars whose earliest start is `S` and lowest layer is `L`, **When** they are pasted at target time `T` and target layer `D`, **Then** each pasted bar uses `start = T + (sourceStart - S)`, preserves duration, and uses `layer = D + (sourceLayer - L)`.
6. **Given** a valid multi-bar payload, **When** paste succeeds, **Then** all pasted bars are selected together in the destination.
7. **Given** any pasted bar would overlap an existing destination bar on the computed layer or the computed placement is invalid, **When** paste is attempted, **Then** Cacablu rejects the whole paste without automatic shifting, partial rows, selection change, or Undo entry.
8. **Given** the user clicks either an empty lane area or a bar, **When** the layer becomes the paste target, **Then** the complete lane is highlighted in yellow behind its bars.
9. **Given** the Timeline has content ending at its current duration, **When** it renders horizontally, **Then** it exposes at least one additional viewport-width editing area after that content where new bars can be created.

---

### User Story 3 - Copy Pool Files And Folders Between Projects (Priority: P1)

As an editor, I want normal copy/paste behavior for project Pool files and folders between tabs so I can reuse complete resource subtrees in another project.

**Why this priority**: Bars often depend on project resources, and transferring only Timeline rows would leave destination projects incomplete.

**Independent Test**: Copy files and nested folders from project A, paste them into the root, a selected folder, and beside a selected file in project B, then verify hierarchy, bytes, metadata, enabled state, and independent destination ids.

**Acceptance Scenarios**:

1. **Given** one or more canonical Pool roots are selected, **When** Copy is invoked from Resources, **Then** the cross-tab payload recursively captures selected files, selected folders, descendants, bytes, MIME type, format, enabled state, names, and hierarchy.
2. **Given** both a selected folder and one of its descendants are selected, **When** Copy runs, **Then** the descendant appears once through the selected ancestor subtree.
3. **Given** no Pool item is selected in the destination, **When** Paste runs in Resources, **Then** Cacablu pastes into the Pool root.
4. **Given** one destination folder is selected, **When** Paste runs, **Then** Cacablu creates the copied roots inside that folder.
5. **Given** one destination file is selected, **When** Paste runs, **Then** Cacablu creates the copied roots beside that file in its containing folder.
6. **Given** multiple destination items are selected, **When** Paste runs, **Then** Cacablu rejects the ambiguous destination without mutation.
7. **Given** a case-insensitive sibling name conflict, malformed path, invalid payload, or failed recursive insert, **When** Paste runs, **Then** the complete Pool paste is rejected atomically.
8. **Given** a successful cross-project Pool paste, **When** the project is saved and reopened, **Then** destination hierarchy, file contents, metadata, and enabled state remain present with destination-owned ids.

---

### User Story 4 - Contextual Clipboard Routing And Undo (Priority: P2)

As an editor, I want Copy and Paste to act on the active editing context and remain undoable so Timeline, Resources, and text editors do not steal each other's clipboard behavior.

**Why this priority**: Cross-project payloads must integrate with existing commands without regressing native text copy/paste or same-project Pool behavior.

**Independent Test**: Exercise Copy/Paste from Timeline, Resources, Monaco, and normal inputs, then Undo successful bar and Pool pastes independently.

**Acceptance Scenarios**:

1. **Given** Timeline is the active application context and bars are selected, **When** Copy runs outside text editing, **Then** Cacablu copies bars rather than Pool items or native text.
2. **Given** Resources is active and Pool items are selected, **When** Copy runs, **Then** Cacablu copies the Pool payload and preserves the existing normalized plain-text `/pool/...` path fallback for text editors.
3. **Given** focus is in a text input, textarea, contenteditable element, or Monaco editor, **When** Copy or Paste runs, **Then** native/editor clipboard behavior takes precedence.
4. **Given** a bar payload while Resources is the paste context, **When** Paste runs, **Then** no project mutation occurs and Cacablu reports that bar payloads must be pasted in Timeline.
5. **Given** a Pool payload while Timeline is the paste context, **When** Paste runs, **Then** no project mutation occurs and Cacablu reports that Pool payloads must be pasted in Resources.
6. **Given** a successful bar or Pool paste, **When** the user invokes Edit > Undo, **Then** Cacablu removes the complete pasted batch as one atomic action without modifying the source project or external clipboard.
7. **Given** the same copied payload is pasted again at another valid destination, **When** Paste runs, **Then** Cacablu creates another independent batch with new destination ids.

---

### User Story 5 - Reconcile Pasted Content With Phoenix (Priority: P3)

As a user with Phoenix connected to the destination tab, I want pasted content synchronized after local commit so the runtime preview matches the destination project.

**Why this priority**: Local cross-project editing must work first, but a connected destination should not require a full manual reload.

**Independent Test**: Paste bars and Pool resources with Phoenix connected and disconnected; verify targeted synchronization, local-first behavior, and error reporting.

**Acceptance Scenarios**:

1. **Given** eligible bars were pasted locally while Phoenix is connected, **When** local transaction commits, **Then** Cacablu publishes the new destination bars through existing section synchronization using their new ids.
2. **Given** Pool resources were pasted locally while Phoenix is connected, **When** local transaction commits, **Then** Cacablu publishes destination files through existing scoped asset synchronization in dependency-safe order.
3. **Given** Phoenix is disconnected, **When** either paste succeeds, **Then** destination project state remains committed and no disconnected-sync error is created.
4. **Given** Phoenix rejects some pasted content, **When** synchronization finishes, **Then** local pasted content remains and Events identifies the affected destination ids or paths.
5. **Given** Undo removes a pasted batch while Phoenix is connected, **When** local Undo commits, **Then** Cacablu removes the corresponding destination sections or Pool resources through existing scoped operations.

### Edge Cases

- Clipboard permission is denied, unavailable, or the browser strips the application-specific format.
- Clipboard payload is truncated, corrupted, from an unsupported future version, or from an untrusted application.
- The payload is very large because it contains nested binary files.
- The source tab closes before Paste.
- Source and destination projects contain overlapping database ids.
- Copied bars span non-contiguous times and layers.
- Destination current time changes after Copy but before Paste.
- Destination selected layer scrolls out of view.
- Bar placement overlaps existing destination content.
- A copied bar script references Pool resources that were not separately copied.
- A destination file is selected but is deleted before Paste.
- Multiple Pool destination items are selected.
- Names differ only by case in the destination.
- Phoenix disconnects while a local paste or Undo synchronization is in flight.

## Requirements

### Functional Requirements

- **FR-001**: Cacablu MUST support self-contained Copy/Paste transfer between independent browser tabs with different loaded projects.
- **FR-002**: Cross-tab transfer MUST use the browser/system clipboard and MUST NOT rely solely on in-memory state, source-tab lifetime, BroadcastChannel state, or a backend.
- **FR-003**: Cacablu clipboard payloads MUST include an application identifier, payload kind, schema version, and integrity/shape validation data sufficient to reject unrelated or malformed clipboard content.
- **FR-004**: Clipboard payload kinds MUST distinguish Timeline bars from Pool resource subtrees.
- **FR-005**: The clipboard MUST preserve a useful `text/plain` fallback for ordinary text destinations, including normalized Pool paths for copied resources.
- **FR-006**: Clipboard read/write or decoding failure MUST leave both projects unchanged and produce a clear non-destructive diagnostic.
- **FR-007**: Timeline Copy MUST snapshot every selected existing bar exactly once without retaining a live source-session dependency.
- **FR-008**: Bar snapshots MUST include name, type, start/end timing, layer, enabled state, script, source/destination blend values, blend equation, and alpha metadata.
- **FR-009**: Destination bar Paste MUST allocate new destination ids and MUST NOT reuse source ids as destination primary keys.
- **FR-010**: Destination bar Paste MUST preserve bar duration, relative time offsets, and relative layer offsets.
- **FR-011**: Cacablu MUST add a per-project Timeline paste target containing a selected numeric layer and the current Timeline time.
- **FR-012**: A simple lane click MUST select that layer and set current time from the clicked horizontal position without replacing drag, box-select, resize, or bar-creation gestures.
- **FR-013**: Timeline MUST render the complete selected paste-target layer in yellow behind its bars and MUST preserve it while current time changes.
- **FR-014**: Timeline Paste MUST be unavailable until a valid destination layer is explicitly selected in the active project session.
- **FR-015**: For a copied bar group, the earliest source start and minimum source layer MUST be the group anchor aligned to the destination time and selected layer.
- **FR-016**: Bar Paste MUST reject the entire batch when computed placement is invalid or overlaps existing destination bars; it MUST NOT silently shift content.
- **FR-017**: Successful bar Paste MUST select all newly created destination bars.
- **FR-018**: Pool Copy MUST recursively snapshot canonical selected roots, hierarchy, file bytes, names, types, formats, byte counts, and enabled state.
- **FR-019**: Pool Paste MUST allocate destination-owned ids and recreate independent files/folders without modifying source rows.
- **FR-020**: Pool Paste destination MUST be the selected folder, the parent of one selected file, or Pool root when selection is empty/root.
- **FR-021**: Multiple Pool destination selections, stale destinations, sibling-name conflicts, malformed paths, and recursive insert failures MUST reject the whole paste atomically.
- **FR-022**: Active Timeline context MUST accept only bar payloads and active Resources context MUST accept only Pool payloads.
- **FR-023**: Native text/editor Copy and Paste MUST take precedence when focus is in an editable control.
- **FR-024**: Each successful bar or Pool Paste MUST create one atomic Undo entry for the complete destination batch.
- **FR-025**: Undo MUST remove only the pasted destination entities and MUST NOT alter the source project or consume/rewind external clipboard ownership.
- **FR-026**: Copy payloads MUST remain reusable for repeated Paste operations until the system clipboard changes.
- **FR-027**: Cross-project Cut/Move MUST NOT be introduced; existing same-session Cut behavior remains separate and cross-tab transfer is copy-only.
- **FR-028**: Copying bars MUST NOT automatically infer or bundle Pool dependencies referenced by scripts; users MAY separately copy required Pool files/folders.
- **FR-029**: Connected Phoenix synchronization MUST occur only after local destination commit and MUST reuse existing section and scoped asset APIs.
- **FR-030**: Phoenix disconnection or synchronization failure MUST NOT roll back destination paste or Undo; failures MUST be reported with destination ids/paths when known.
- **FR-031**: The feature MUST preserve browser-only static deployment and MUST add no database schema or Phoenix endpoint requirement.
- **FR-032**: Saved and reopened destination projects MUST retain pasted bars and Pool resources with their destination-owned ids.
- **FR-033**: Clipboard decoding MUST enforce bounded, validated binary lengths and safe normalized Pool paths before allocating or mutating project data.
- **FR-034**: Clicking either a Timeline lane or a bar MUST select and visibly highlight that bar's complete layer.
- **FR-035**: Timeline MUST provide at least one viewport width of horizontally scrollable editing space after its current content end, and lane clicks/bar creation in that space MUST use their real horizontal time.

### Key Entities

- **Cross-Project Clipboard Envelope**: Versioned application-specific clipboard representation containing one payload kind, source metadata for diagnostics, and a self-contained immutable snapshot.
- **Bar Clipboard Payload**: Ordered bar snapshots plus the source group anchor derived from earliest start and minimum layer.
- **Pool Clipboard Payload**: Canonical file/folder roots containing recursive hierarchy, metadata, enabled state, and file bytes.
- **Timeline Paste Target**: Per-project pair of selected numeric layer and current Timeline time, with visible lane feedback.
- **Destination Paste Batch**: Atomic group of newly allocated destination bars or Pool entities created by one Paste command.
- **Paste Undo Entry**: One action capable of removing the exact destination batch if it has not been modified incompatibly.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A bar payload copied in one tab can be pasted after the source tab closes, proving the payload is self-contained.
- **SC-002**: Single- and multi-bar pastes preserve 100% of defined bar properties, durations, relative time offsets, and relative layer offsets while using new ids.
- **SC-003**: Browser validation shows a persistent selected-layer highlight and pastes the group anchor at the visible current time/layer target.
- **SC-004**: Invalid or overlapping bar placement creates zero destination rows and zero Undo entries.
- **SC-005**: Nested Pool copy/paste preserves 100% of file bytes, hierarchy, names, metadata, and enabled state with destination-owned ids.
- **SC-006**: Every invalid/conflicting Pool paste leaves zero partial files or folders.
- **SC-007**: Timeline, Resources, and editable-text contexts route Copy/Paste without stealing one another's behavior.
- **SC-008**: One Undo removes 100% of one pasted batch and leaves source project and clipboard unchanged.
- **SC-009**: Disconnected paste performs zero Phoenix requests and connected failure leaves local destination state intact with diagnostics.
- **SC-010**: Automated tests cover cross-tab serialization, schema rejection, target calculation, atomic collisions, Pool binaries, repeated paste, Undo, and connected/disconnected synchronization.
- **SC-011**: Typecheck, scoped lint, full tests, production build, and two-tab browser validation pass without new errors.

## Assumptions

- "Filesystem" refers to the Pool file/folder tree stored in each loaded Cacablu project, not arbitrary host filesystem paths.
- The supported desktop browser preserves an application-specific clipboard representation during a user-initiated Copy/Paste sequence; a clear error is acceptable when permissions or browser policy prevent it.
- Bar dependencies are not inferred from free-form scripts; required Pool resources are copied explicitly through Resources.
- Destination collision behavior follows current Cacablu guarantees: reject atomically rather than overwrite, rename, merge, or auto-shift.
- Source projects are never modified by cross-tab Paste or Undo.
- Cross-tab Cut/Move and automatic dependency collection may be proposed as later features.
