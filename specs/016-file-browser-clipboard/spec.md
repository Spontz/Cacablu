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

## Success Criteria

- **SC-001**: Automated browser tests pass for keyboard/menu Copy, Cut, Paste, pending opacity, root destinations, editor paste, and editor drop.
- **SC-002**: Invalid destinations produce zero partial project mutations.
- **SC-003**: Typecheck, lint, tests, and production build pass.

## Assumptions

- Clipboard file-list export to Explorer/Desktop requires a future native host and is outside the guaranteed browser contract.
