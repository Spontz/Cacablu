# Feature Specification: File Browser Clipboard

**Feature Branch**: `016-file-browser-clipboard`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Context-aware Cut, Copy, Paste, drag paths, and Pool-root destinations in Cacablu.

## Runtime Context

**Browser Surface**: Pool file browser, Edit menu, Monaco editors, and external file drop targets.  
**Local Engine Dependency**: Optional; enabled asset mutations synchronize through existing Phoenix asset operations.  
**Static Deployment Impact**: Browser-only; uses DOM clipboard/drag APIs and the loaded SQLite session.  
**Real-Time Sensitivity**: Selection, pending-cut feedback, and paste validation must be immediate.  
**File System Access Requirement**: Required for project open/save and external file import; internal clipboard operations remain database-backed.

## User Scenarios & Testing

### User Story 1 - Copy Or Move Pool Items (Priority: P1)

Users can select one or more files/folders, Cut or Copy them, and Paste into a folder or the explicit Pool root without corrupting hierarchy or contents.

**Independent Test**: Copy and cut files and folders to nested and root destinations, then verify data, ids for moves, enabled state, conflicts, opacity, and Undo.

**Acceptance Scenarios**:

1. **Given** selected Pool roots, **When** Copy then Paste targets a folder, **Then** Cacablu recursively creates independent copies and preserves source items.
2. **Given** selected Pool roots, **When** Cut is invoked, **Then** their rows remain at 50% opacity until Paste, invalidation, or clipboard replacement.
3. **Given** a pending Cut, **When** Paste succeeds, **Then** the same ids move to the exact destination and pending-cut state is consumed.
4. **Given** a stale source, conflict, self/descendant destination, or multiple destinations, **When** Paste is attempted, **Then** no partial mutation occurs.

### User Story 2 - Use Pool Paths In Text Editors (Priority: P1)

Users can paste or drag selected Pool assets into text editors as normalized `/pool/...` paths.

**Independent Test**: Copy and drag Pool files into section and GLSL Monaco editors and verify exact inserted text.

**Acceptance Scenarios**:

1. **Given** one or more copied Pool roots, **When** the user pastes into a text field or Monaco, **Then** one normalized `/pool/...` path per line is inserted.
2. **Given** a Pool file drag, **When** it is dropped into a code editor, **Then** its `/pool/...` path is inserted without moving the project asset.

### User Story 3 - Target The Pool Root (Priority: P2)

Users can paste internal items or drop external files directly into the Pool root.

**Independent Test**: Paste and drop files on the explicit root row and verify parent id `0` and normalized paths.

### User Story 4 - Move Selected Pool Items By Dragging (Priority: P1)

Users can drag files or folders inside the Pool and move the complete canonical selection to an exact folder or root destination as one reversible operation.

**Independent Test**: Select multiple files, drag one selected file into another folder, then drag a folder with descendants onto content inside a destination folder; verify exact hierarchy, selection, Undo, validation, and Phoenix reconciliation.

**Acceptance Scenarios**:

1. **Given** multiple canonical Pool roots are selected, **When** the user drags any selected root to a valid destination, **Then** every selected root moves together and remains selected after the move.
2. **Given** an unselected file or folder is dragged, **When** the drag begins, **Then** only that item is moved.
3. **Given** a folder with descendants is dragged, **When** it is dropped on another valid folder, **Then** the folder and its complete subtree move without changing their ids or contents.
4. **Given** a folder is expanded, **When** the user drops on its row, a contained file, or empty space within its rendered interior, **Then** that folder is the exact destination.
5. **Given** a conflict, stale source, self destination, or descendant destination, **When** a batch drag is dropped, **Then** the complete operation is rejected with no partial mutation.
6. **Given** a batch drag succeeds, **When** the user invokes Undo, **Then** all moved roots return to their original parents in one action and enabled Phoenix paths are reconciled.

## Requirements

### Functional Requirements

- **FR-001**: Clipboard routing MUST preserve native behavior in text-editing targets and use Pool commands when Resources is active.
- **FR-002**: Pool selection MUST support single and multiple canonical roots.
- **FR-003**: Copy and Cut MUST publish normalized `/pool/...` text to the system clipboard.
- **FR-004**: Cut roots MUST remain visibly pending at 50% opacity until consumed or invalidated.
- **FR-005**: Copy/Paste MUST recursively duplicate file bytes, metadata, hierarchy, and enabled state.
- **FR-006**: Cut/Paste MUST move existing ids and preserve descendants.
- **FR-007**: Folder and Pool-root destinations MUST be supported for Paste and drag/drop.
- **FR-008**: Invalid, stale, conflicting, self, or descendant operations MUST be rejected atomically.
- **FR-009**: Successful enabled-asset changes MUST use existing scoped Phoenix reconciliation.
- **FR-010**: Copy/Paste and Cut/Paste MUST participate in application Undo without rewinding external clipboard ownership.
- **FR-011**: Native operating-system file export MAY remain unavailable in a browser-only runtime; internal paste and text paths are mandatory.
- **FR-012**: The feature MUST preserve static deployment and add no Phoenix C++ or database-schema dependency.
- **FR-013**: Starting an internal drag on a selected Pool item MUST carry every canonical selected root; starting it on an unselected item MUST carry only that item.
- **FR-014**: Both file and folder rows MUST be draggable, and moving a folder MUST preserve its complete descendant hierarchy, ids, bytes, metadata, and enabled state.
- **FR-015**: A destination folder MUST accept internal drops on its row, on contained files, and on visible whitespace inside its expanded rendered area; the explicit Pool root MUST continue to target the root.
- **FR-016**: Internal drag moves MUST use one atomic database operation, preserve the moved batch as the current selection, and create one Undo entry that restores every original parent.
- **FR-017**: Successful internal drag moves MUST reconcile every affected enabled asset path with Phoenix only after the local batch commit succeeds.

## Success Criteria

- **SC-001**: Automated browser tests pass for keyboard/menu Copy, Cut, Paste, pending opacity, root destinations, editor paste, and editor drop.
- **SC-002**: Invalid destinations produce zero partial project mutations.
- **SC-003**: Typecheck, lint, tests, and production build pass.
- **SC-004**: Edge Playwright verifies multi-file drag, preserved selection, folder-subtree drag, inner-folder drop targets, and single-step Undo.
- **SC-005**: Native Selenium Edge validation against an actual SQLite project confirms that a folder can be moved into another folder by pointer drag.

## Assumptions

- Clipboard file-list export to Explorer/Desktop requires a future native host and is outside the guaranteed browser contract.
