# Feature Specification: Database Explorer

**Feature Branch**: `005-database-explorer`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: User description: "Una ventana que nos servirá para explorar la DB que hay cargada. Tendrá a la izquierda un listbox con las tablas de la DB, y a la derecha tendrá otro listbox donde, si hacemos click en una tabla de la izquierda, se cargarán sus filas y columnas de esa tabla. Este visor debe estar disponible bajo el menú Window. Se llamará Database Explorer."

## Runtime Context *(mandatory)*

**Browser Surface**: A dockable panel inside the main application shell, registered as a workspace panel and accessible from the Window menu  
**Local Engine Dependency**: The panel does not require the local visuals engine; it reads only from the in-memory database session already loaded by the shell  
**Static Deployment Impact**: The panel must remain fully usable in a static browser application with no backend or server dependency  
**Real-Time Sensitivity**: Table selection and row display must respond instantly to user interaction; no background loading or async operations should be required once the database is in memory  
**File System Access Requirement**: The panel does not access the file system directly; it depends on the active database session provided by the shell

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Database Tables (Priority: P1)

As a user, I want to see a list of the tables in the loaded database so that I can understand the structure of the project file at a glance.

**Why this priority**: The table list is the entry point for all exploration; without it the panel has no purpose.

**Independent Test**: Open a database file, open the Database Explorer panel, and confirm that all available tables are listed on the left side.

**Acceptance Scenarios**:

1. **Given** a database is loaded and the Database Explorer panel is open, **When** the panel renders, **Then** the left side shows a list of the database table names.
2. **Given** no database is loaded, **When** the panel renders, **Then** the left side shows a message indicating that no database is open.
3. **Given** a database is loaded, **When** the user opens the panel, **Then** no table is pre-selected and the right side is empty or shows a prompt.

---

### User Story 2 - Inspect Table Contents (Priority: P1)

As a user, I want to click a table name and see its rows and columns on the right side so that I can inspect the actual data stored in the project file.

**Why this priority**: Viewing table contents is the core value of the explorer; the table list alone is not enough.

**Independent Test**: Click each table in the list and confirm that the right side updates to show the correct columns and rows for that table.

**Acceptance Scenarios**:

1. **Given** a database is loaded and a table is selected, **When** the user clicks a table name in the left list, **Then** the right side updates to display the column headers and all rows of that table.
2. **Given** a table is selected, **When** the right side renders, **Then** column names appear as headers and each row is shown as a separate entry below.
3. **Given** the user clicks a different table, **When** the selection changes, **Then** the right side clears and shows the contents of the newly selected table.
4. **Given** a table is empty, **When** the user selects it, **Then** the right side shows the column headers but no data rows, with a clear indication that the table is empty.

---

### User Story 3 - Open the Panel from the Window Menu (Priority: P2)

As a user, I want to open the Database Explorer from the Window menu so that I can access it without needing to know its keyboard shortcut or panel ID.

**Why this priority**: Discoverability from the menu is required for the panel to be useful to new users.

**Independent Test**: Use the Window menu to open the Database Explorer and confirm the panel appears in the workspace.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** the user selects "Database Explorer" from the Window menu, **Then** the panel appears as a floating window over the workspace.
2. **Given** the panel is already open, **When** the user selects it again from the Window menu, **Then** the panel is focused rather than duplicated.
3. **Given** the application has just launched, **When** the workspace renders, **Then** the Database Explorer is not visible until the user opens it from the menu.

---

### User Story 4 - Edit Database Field Values (Priority: P1)

As a user, I want to change displayed database field values directly in the Database Explorer so that I can temporarily correct or experiment with project data without leaving the app.

**Why this priority**: Direct editing turns the explorer into a practical project repair and debugging tool, especially while validating exported engine data.

**Independent Test**: Open a database file, open the Database Explorer, select a table with editable text or numeric values, change a field value, and confirm the new value is reflected in the active database view and subsequent app behavior that reads that value.

**Acceptance Scenarios**:

1. **Given** a database is loaded and a table row is visible, **When** the user edits a supported field value and commits the change, **Then** the displayed cell updates to the new value.
2. **Given** the user edits a supported field value, **When** the new value is accepted, **Then** the active database session uses the updated value for subsequent reads inside the app.
3. **Given** the user enters a value that cannot be represented by the field, **When** the edit is committed, **Then** the change is rejected and the previous value remains visible.
4. **Given** the user edits a value but cancels before committing, **When** the edit is cancelled, **Then** the original value remains unchanged.

---

### Edge Cases

- What happens when the database is closed while the Database Explorer panel is open?
- What happens when a table has a very large number of rows?
- What happens when a column contains binary data (e.g. the `data` column in the FILES table)?
- What happens when the panel is opened before any database is loaded?
- What happens when the user edits a field whose value is used by another visible panel?
- What happens when the user attempts to edit a binary column or identifier column?
- What happens when the user enters an invalid number, empty value, or unsupported text for the selected field?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a panel called "Database Explorer" registered in the workspace panel registry.
- **FR-002**: The system MUST add a "Database Explorer" option to the Window menu that opens the panel as a floating window or focuses it if already open.
- **FR-013**: The panel MUST open as a floating window rather than a docked tab; it must NOT appear in the workspace by default on launch.
- **FR-003**: The panel MUST display the list of tables available in the currently loaded database on its left side.
- **FR-004**: The panel MUST update the table list whenever the active database session changes (new file opened or database closed).
- **FR-005**: The panel MUST display the column headers and all rows of the selected table on its right side when the user clicks a table name.
- **FR-006**: The panel MUST clear the right side and show an appropriate placeholder when no table is selected.
- **FR-007**: The panel MUST show a placeholder message on the left side when no database is loaded.
- **FR-008**: Binary column values (BLOB data) MUST be shown as a human-readable summary (e.g. byte count) rather than raw binary content.
- **FR-009**: The panel MUST allow direct editing of supported non-binary cell values in the selected table.
- **FR-010**: The panel MUST remain part of the static deployable application with no backend dependency.
- **FR-011**: The panel MUST reject edits that cannot be represented by the selected field and keep the previous value unchanged.
- **FR-012**: The panel MUST keep binary data columns read-only and continue showing them as human-readable summaries.
- **FR-014**: The panel MUST apply accepted edits to the active database session so subsequent app views and exports use the updated values.
- **FR-015**: The panel MUST provide a clear way to commit or cancel an in-progress cell edit.

### Key Entities *(include if feature involves data)*

- **Table List**: The set of table names available in the loaded database, shown in the left side of the panel.
- **Selected Table**: The table the user has clicked, whose contents are shown on the right side.
- **Table View**: The right-side display of column headers and row data for the selected table.
- **Editable Cell**: A displayed field value that can be changed directly by the user when the field is supported for editing.
- **Active Database Session**: The in-memory database provided by the shell; the panel reads from this, it does not open files itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the Database Explorer from the Window menu and see the panel appear as a floating window; it is not visible on launch before the user opens it.
- **SC-002**: A user can click any table in the left list and see its columns and rows appear on the right side.
- **SC-003**: Manual validation confirms the panel shows a clear placeholder when no database is loaded.
- **SC-004**: Manual validation confirms that BLOB columns display a byte count summary rather than raw data.
- **SC-005**: Manual validation confirms a user can edit a supported field value and see that updated value used by the active app session.
- **SC-006**: Project lint, typecheck, and build checks complete without new errors for this feature.
- **SC-007**: Manual validation confirms invalid edits are rejected without corrupting the displayed row or active session.

## Assumptions

- The panel reads data from the in-memory `ProjectDatabase` already loaded by the shell; it does not query SQLite directly.
- The table list is fixed to the known schema tables: VARIABLES, BARS, FBOs, FILES, FOLDERS.
- Editing is intended for supported scalar values such as text, numbers, and booleans; binary data remains read-only.
- Row counts are expected to be small enough for full display without pagination in this first version.
