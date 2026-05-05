# Feature Specification: Project File Explorer

**Feature Branch**: `006-project-file-explorer`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "Quiero examinar el proyecto que cargamos para listar el árbol de archivos disponibles en el mismo, en una ventana"

## Runtime Context *(mandatory)*

**Browser Surface**: The Resources panel inside a project window; each project window corresponds to exactly one open database file, and all panels in that window — including Resources — belong exclusively to that project  
**Local Engine Dependency**: The feature does not require the local visuals engine; it reads only from the in-memory database session owned by the project window  
**Static Deployment Impact**: The feature must remain fully usable in a static browser application with no backend or server dependency  
**Real-Time Sensitivity**: The file tree must reflect the database state as soon as the project window is ready; expanding and collapsing nodes must respond instantly to user interaction  
**File System Access Requirement**: The feature does not access the file system directly; it depends on the database session owned by the enclosing project window

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Project File Tree (Priority: P1)

As a user, I want to see the folder and file hierarchy of the loaded project so that I can understand what assets are embedded in the project file at a glance.

**Why this priority**: Showing the tree structure is the sole purpose of the panel; without it the panel delivers no value.

**Independent Test**: Open a database file and confirm that the Resources panel renders the folder and file hierarchy as a tree with folders expandable and files listed beneath them.

**Acceptance Scenarios**:

1. **Given** a database is loaded and the Resources panel is visible, **When** the panel renders, **Then** the root level shows all top-level folders and any files with no parent folder.
2. **Given** a folder is shown in the tree, **When** the user expands it, **Then** its child folders and files appear nested beneath it.
3. **Given** a folder is expanded, **When** the user collapses it, **Then** its children are hidden and the folder appears collapsed.
4. **Given** no database is loaded, **When** the Resources panel renders, **Then** the tree is empty and shows a message indicating that no project is open.

---

### User Story 2 - Distinguish Folders from Files (Priority: P1)

As a user, I want folders and files to look visually different so that I can navigate the tree without confusion.

**Why this priority**: A tree where all nodes look identical is unusable; visual distinction is essential for navigation.

**Independent Test**: Open a project with at least one folder containing files and confirm that folders and files are rendered with distinct icons or labels that make their type immediately clear.

**Acceptance Scenarios**:

1. **Given** the tree is rendered, **When** the user looks at a folder node, **Then** it is displayed with a visual indicator that distinguishes it as a folder (e.g. an icon or prefix).
2. **Given** the tree is rendered, **When** the user looks at a file node, **Then** it is displayed with a visual indicator that distinguishes it as a file.
3. **Given** a file node is visible, **When** the user reads it, **Then** the file name and its type are both shown so the user can identify the asset.

---

### User Story 3 - File Tree Visible on Application Launch (Priority: P2)

As a user, I want the file tree to be visible in the Resources panel as soon as I open a project, without any extra step to open a separate window.

**Why this priority**: Because the tree lives in the always-present Resources panel, it is available immediately; there is no need for a menu action to reveal it.

**Independent Test**: Launch the application, open a database file, and confirm that the Resources panel shows the file tree without requiring any additional menu action.

**Acceptance Scenarios**:

1. **Given** the application has just launched, **When** the workspace renders, **Then** the Resources panel is visible in the workspace layout and shows the empty-project placeholder.
2. **Given** a database is loaded, **When** the Resources panel is visible, **Then** the file tree appears automatically without the user needing to open a separate window.

---

### User Story 4 - Each Project Window Has Its Own File Tree (Priority: P2)

As a user, I want each open project to have its own Resources panel showing its own file tree, so that opening multiple projects at once does not mix their assets.

**Why this priority**: One DB is one project; its panels are exclusively bound to it. This isolation is fundamental to the multi-project workflow.

**Independent Test**: Open two database files in separate project windows and confirm that each window's Resources panel shows only the files from its own database, independently of the other.

**Acceptance Scenarios**:

1. **Given** a project window is open, **When** the user opens a second database file, **Then** a new independent project window opens for the second database without affecting the first window.
2. **Given** two project windows are open, **When** the user looks at the Resources panel of the first window, **Then** it shows only the files and folders from the first database.
3. **Given** two project windows are open, **When** the user looks at the Resources panel of the second window, **Then** it shows only the files and folders from the second database.
4. **Given** a project window is closed, **When** it is removed, **Then** its Resources panel and all its data are discarded without affecting any other open project window.

---

### Edge Cases

- What happens when a folder has no children (empty folder)?
- What happens when the FOLDERS or FILES table is absent from the database?
- What happens when the `parent` field of a folder references a folder id that does not exist?
- What happens when the database contains a very large number of files or deeply nested folders?
- What happens when the Resources panel is visible and no project tab is active?
- What happens when a project tab is closed while its file tree is displayed in the Resources panel?
- What happens when a file has a null or empty name?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement the file tree as the content of the existing Resources panel; no new panel registration is required.
- **FR-002**: The Resources panel MUST be visible in the default workspace layout on application launch, replacing its current placeholder content with the file tree.
- **FR-003**: The file tree MUST display a hierarchical tree of folders and files derived from the FOLDERS and FILES tables of the currently loaded database.
- **FR-004**: The tree MUST be built using the `parent` field in both FOLDERS and FILES to determine parent-child relationships; FOLDERS with a null or zero parent and FILES with a null or zero parent MUST appear at the root level.
- **FR-005**: The Resources panel MUST allow the user to expand and collapse folder nodes to show or hide their children.
- **FR-006**: The Resources panel MUST visually distinguish folder nodes from file nodes so the user can identify them at a glance.
- **FR-007**: Each file node MUST display the file name and its type.
- **FR-008**: The Resources panel MUST show a placeholder message when no database is loaded or when both FOLDERS and FILES are empty.
- **FR-009**: Opening a second database file MUST open it in a new independent project window; it MUST NOT replace or affect any existing project window.
- **FR-010**: Each project window MUST own its Resources panel exclusively; the file tree in a window MUST only show data from that window's database.
- **FR-011**: The Resources panel MUST show the empty-project placeholder when its project window has no database loaded.
- **FR-012**: The Resources panel MUST remain a read-only view; it must not allow renaming, deleting, or moving files or folders.
- **FR-013**: The feature MUST remain part of the static deployable application with no backend dependency.

### Key Entities *(include if feature involves data)*

- **Folder Node**: A node in the tree representing a row from the FOLDERS table, identified by its `name`; it may contain child folder nodes and file nodes.
- **File Node**: A leaf node in the tree representing a row from the FILES table, identified by its `name` and `type`; it always appears inside a folder or at root level.
- **Tree Root**: The virtual top-level container that holds all folders and files whose `parent` is null or zero.
- **Project Window**: A self-contained workspace window for one open database file; it owns all its panels (Resources, Timeline, Preview, Inspector, etc.) exclusively.
- **Database Session**: The in-memory database owned by a project window; the Resources panel in that window reads FOLDERS and FILES from it and does not access other windows' sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a project and see the file tree appear immediately in the Resources panel without any additional action.
- **SC-002**: A user can expand and collapse folders in the Resources panel tree and see the correct child folders and files appear or disappear.
- **SC-003**: Manual validation confirms that folder nodes and file nodes are visually distinguishable from each other.
- **SC-004**: Manual validation confirms that the panel shows a clear placeholder when no database is loaded.
- **SC-005**: Manual validation confirms that each project window's Resources panel shows only the files from its own database, independently of any other open project window.
- **SC-007**: Manual validation confirms that opening a second database opens a new independent project window without closing or affecting the first.
- **SC-006**: Project lint, typecheck, and build checks complete without new errors for this feature.

## Assumptions

- One database file = one project = one project window; panels within a window are exclusively bound to that window's database and do not share state with other windows.
- The Resources panel reads folder and file data from its project window's in-memory database; it does not query the SQLite file directly.
- The tree is read-only in this version; editing assets is out of scope.
- Files without a matching parent folder (broken reference) are shown at root level rather than discarded.
- Empty folders are shown in the tree; their visual state makes clear that they contain no children.
- The `data` (BLOB) column of FILES is never read or displayed by this panel; only name, type, and tree position are used.
- Row counts for FILES and FOLDERS are expected to be small enough for full rendering without virtualization in this first version.
