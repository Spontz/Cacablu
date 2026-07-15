# Feature Specification: File Browser Item Actions And Undo

**Feature Branch**: `020-file-browser-item-actions`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Per-item Pool menus for folder creation, clipboard commands, rename, delete, path rewriting, and Undo.

## Runtime Context

**Browser Surface**: Pool file browser, dialogs, Edit/Undo integration, and Events.  
**Local Engine Dependency**: Optional; local project state is authoritative and connected Phoenix receives scoped reconciliation.  
**Static Deployment Impact**: Browser-only DOM and loaded SQLite session.  
**Real-Time Sensitivity**: First click must select/open the menu immediately; mutations may not block basic browsing.  
**File System Access Requirement**: Required for normal project open/save only.

## User Scenarios & Testing

### User Story 1 - Use A Stable Per-Item Action Menu (Priority: P1)

Every Pool row exposes a small always-visible ellipsis that opens an unclipped menu bound to that exact item.

**Independent Test**: Open root, folder, and file menus on first click and verify actions, icons, separators, placement, and captured target.

**Acceptance Scenarios**:

1. **Given** a file row, **When** its ellipsis is activated, **Then** Cut, Copy, Rename, and Delete appear, with a separator before Delete.
2. **Given** a folder row, **When** its ellipsis is activated, **Then** New Folder, Cut, Copy, Paste, Rename, and Delete appear, with separators after New Folder and before Delete.
3. **Given** the Pool root, **When** its ellipsis is activated, **Then** New Folder and Paste appear and root cannot be cut, copied, renamed, or deleted.
4. **Given** Dockview clipping, **When** the menu extends beyond Resources, **Then** its document-level overlay remains visible and actionable.

### User Story 2 - Create And Rename Safely (Priority: P1)

Users can create folders and rename assets, optionally updating exact `/pool/...` references in project scripts.

**Independent Test**: Create root/nested folders; rename files/folders with update, keep, and cancel choices; then Undo.

**Acceptance Scenarios**:

1. **Given** a valid unique folder name, **When** New Folder is confirmed, **Then** one database folder is created under the captured destination and can be undone.
2. **Given** affected exact script paths, **When** Rename and Update Script Paths is chosen, **Then** asset and script rewrites commit atomically and Undo restores both.
3. **Given** invalid names, conflicts, or cancellation, **When** creation/rename is attempted, **Then** project and history remain unchanged.

### User Story 3 - Delete And Move With Undo (Priority: P1)

Delete, Copy/Paste, and Cut/Paste mutations participate in one conflict-safe application history.

**Independent Test**: Delete subtrees and perform clipboard mutations, then Undo exact ids, hierarchy, bytes, metadata, and parents.

## Requirements

- **FR-001**: Ellipsis buttons MUST remain visible, compact, right-aligned, and first-click selectable.
- **FR-002**: Menus MUST be document-level overlays anchored beside their button and kept in the viewport.
- **FR-003**: Menus MUST close on action, Escape, outside click, project change, or stale target.
- **FR-004**: All menu actions MUST use the captured target; clipboard commands MUST reuse the existing clipboard workflow.
- **FR-005**: Names MUST reject empty/dot names, separators, control characters, and case-insensitive sibling conflicts.
- **FR-006**: File/folder rename MUST preserve ids, contents, hierarchy, metadata, and enabled state.
- **FR-007**: Rename MUST offer update, keep, and cancel choices when exact normalized script references are affected.
- **FR-008**: Folder-prefix rewrites MUST preserve descendant suffixes and avoid longer unrelated literals.
- **FR-009**: Recursive Delete MUST retain a complete immutable restoration payload.
- **FR-010**: Create, rename, delete, Copy/Paste, Cut/Paste, and their inverses MUST be atomic Undo commands.
- **FR-011**: Undo conflicts MUST leave project state untouched and retain the history entry.
- **FR-012**: Connected Phoenix reconciliation MUST publish all destinations before resending rewritten sections and deleting obsolete paths.
- **FR-013**: Phoenix failure MUST be reported in Events without rolling back authoritative local state.
- **FR-014**: Menu commands MUST show decorative icons; menu-bar trigger labels remain text-only.

## Success Criteria

- **SC-001**: Playwright verifies first-click menus, exact actions, icons, separators, placement, and clipping resistance.
- **SC-002**: Database tests prove exact recursive restore and atomic failure behavior.
- **SC-003**: Rename path updates cannot reload Phoenix sections against a partially published destination.
- **SC-004**: Typecheck, tests, lint, build, and manual loaded-project validation pass.

## Assumptions

- Phoenix requires no new endpoint or C++ implementation for these operations.
