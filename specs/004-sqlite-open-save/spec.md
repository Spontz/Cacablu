# Feature Specification: SQLite Open and Save

**Feature Branch**: `004-sqlite-open-save`  
**Created**: 2026-04-16  
**Status**: Implemented  
**Input**: User description: "Esta app va a leer y guardar datos de una base de datos .sqlite que se podrá abrir desde el menú \"Abrir\" del proyecto. Al seleccionar esta opción la app debe preguntar por un archivo de tipo .sqlite, y cuando se seleccione la opción de guardar, debe de escribirse en este mismo archivo a través de la File System Access API del navegador"

## Runtime Context *(mandatory)*

**Browser Surface**: The main browser application shell, specifically the File menu flow for opening and saving a local database file  
**Local Engine Dependency**: The feature does not require the local visuals engine to open or save the database file, but it must keep the shell usable if the engine is disconnected  
**Static Deployment Impact**: The feature must keep the app usable as a static browser application with no backend or server dependency  
**Real-Time Sensitivity**: Opening and saving the database must not freeze the interface or block normal workspace interaction for longer than necessary  
**File System Access Requirement**: The feature requires browser support for the File System Access API so the user can pick a `.sqlite` file and later save changes back to the same file

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a Local SQLite Database (Priority: P1)

As a user, I want to open a `.sqlite` database file from the project menu so that I can work with local project data in the app.

**Why this priority**: Opening the database is the entry point for all read and write workflows.

**Independent Test**: Use the menu to open a local `.sqlite` file and confirm the app loads its contents without requiring a server.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user selects the `Abrir` option from the project menu, **Then** the browser asks the user to choose a local file restricted to `.sqlite` databases.
2. **Given** the user selects a valid `.sqlite` file, **When** the file is confirmed, **Then** the app loads the database content and shows that the file is ready for use.
3. **Given** the user cancels the file picker, **When** no file is selected, **Then** the app remains usable and keeps the previous state unchanged.

---

### User Story 2 - Save Back to the Same File (Priority: P2)

As a user, I want to save changes back into the same database file so that my edits remain in the local `.sqlite` file I opened.

**Why this priority**: The main value of the feature is round-tripping changes to the original local database.

**Independent Test**: Open a database, make a change, select save, and confirm the same file is updated rather than creating a separate copy by default.

**Acceptance Scenarios**:

1. **Given** a `.sqlite` file is already open, **When** the user selects the save option, **Then** the app writes the current data back to the same file.
2. **Given** the app has unsaved changes, **When** the save action completes successfully, **Then** the app shows that the database is synchronized with the file on disk.
3. **Given** the open file is no longer writable or available, **When** the user tries to save, **Then** the app reports the problem clearly and keeps the current working state intact.

---

### User Story 3 - Save a Copy to a Different File (Priority: P2)

As a user, I want to save the current database to a new file so that I can keep the original intact and work from a copy.

**Why this priority**: Essential for non-destructive workflows — the user may want to branch a project or archive a version without overwriting the original.

**Independent Test**: Open a database, select "Guardar como", choose a new filename, and confirm a new file is created while the app continues working from the new file.

**Acceptance Scenarios**:

1. **Given** a `.sqlite` file is open, **When** the user selects the "Guardar como" option, **Then** the browser asks the user to choose a destination filename and location restricted to `.sqlite` files.
2. **Given** the user confirms a new file location, **When** the save completes successfully, **Then** the new file becomes the active working file and the app shows the new filename.
3. **Given** the user cancels the "Guardar como" picker, **When** no destination is chosen, **Then** the app keeps the original file as the active working file unchanged.
4. **Given** the save-as operation fails, **When** the error occurs, **Then** the app reports the problem and keeps the original file as the active working file.

---

### User Story 4 - Load BARS into the Timeline (Priority: P1)

As a user, I want the timeline to automatically populate with the bars from the loaded database so that I can see the project's content immediately after opening a file.

**Why this priority**: Loading database content into the timeline is the main reason to open a project file; without it the database is only visible in the Database Explorer but has no effect on the workspace.

**Independent Test**: Open a `.sqlite` file that contains rows in the BARS table and confirm that the timeline clears its previous content and displays one bar per row, positioned at the correct start and end times, with the bar's type shown as its label.

**Acceptance Scenarios**:

1. **Given** a `.sqlite` file is opened and it contains rows in BARS, **When** the database finishes loading, **Then** the timeline clears its current content and renders one bar per row using each bar's `startTime` and `endTime` to define its position and duration.
2. **Given** the database has been loaded, **When** the timeline renders the bars, **Then** each bar displays the value of its `type` field as a text label inside the bar.
3. **Given** the database has been loaded, **When** the timeline renders the bars, **Then** all bars that share the same `layer` value appear on the same track row, and multiple bars can coexist on the same track simultaneously.
4. **Given** the BARS table is empty or absent, **When** the database finishes loading, **Then** the timeline clears its previous content and shows an empty timeline without errors.
5. **Given** a new database is opened while bars from a previous file are displayed, **When** the new file finishes loading, **Then** the timeline replaces all previous bars with the bars from the new file.

---

### User Story 5 - Understand File Access Limits (Priority: P3)

As a user, I want the app to make file access limits clear so that I understand when local database access is unavailable or restricted.

**Why this priority**: Local file workflows can fail for browser or permission reasons, and the user needs a clear outcome.

**Independent Test**: Attempt to open or save when file access is denied and confirm the app explains the failure without crashing.

**Acceptance Scenarios**:

1. **Given** the browser does not allow file access, **When** the user tries to open or save a database, **Then** the app explains that the operation cannot continue.
2. **Given** the selected file is not a valid `.sqlite` database, **When** the user tries to open it, **Then** the app rejects the file and keeps the current workspace usable.

### Edge Cases

- What happens when the BARS table contains bars with overlapping times on the same layer? (Expected: both bars are rendered on the same track; no bar is hidden or suppressed.)
- What happens when a bar's `startTime` is greater than its `endTime`?
- What happens when a bar's times fall outside the project `startTime`/`endTime` range from VARIABLES?
- What happens when the user cancels the file picker without choosing a file?
- What happens when the selected file has the wrong extension or is not a valid SQLite database?
- What happens when the browser refuses write access after the file has already been opened?
- What happens when the file was modified outside the app before the user saves?
- What happens when the browser supports opening files but not writing back to the same file?
- What happens when the user picks the same file in "Guardar como" that is already open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a menu action labeled `Abrir` for opening a local database file.
- **FR-002**: The system MUST prompt the user to choose a local file when the open action is selected.
- **FR-003**: The system MUST restrict the file selection flow to `.sqlite` database files.
- **FR-004**: The system MUST load the selected database into the app and make its data available to the workspace.
- **FR-005**: The system MUST keep the app usable if the open flow is canceled, denied, or fails.
- **FR-006**: The system MUST provide a save action that writes changes back to the same file that was previously opened.
- **FR-007**: The system MUST preserve the open database as the active working file until the user opens a different file or performs a save-as.
- **FR-013**: The system MUST provide a "Guardar como" action that prompts the user for a new `.sqlite` destination and writes the current database to that file.
- **FR-014**: The system MUST make the newly saved file the active working file after a successful "Guardar como" operation.
- **FR-008**: The system MUST report file access or save failures in a user-visible way without losing the current in-memory work state.
- **FR-009**: The system MUST remain deployable as a static browser application with no backend dependency.
- **FR-010**: The system MUST require browser support for the File System Access API, or otherwise clearly explain that file-based open and save actions are unavailable.
- **FR-011**: The system MUST keep the shell responsive while opening or saving local database files.
- **FR-012**: The system MUST preserve clear module boundaries and understandable code for file access and database handling.
- **FR-015**: The system MUST clear the timeline content when a new database is successfully loaded.
- **FR-016**: The system MUST populate the timeline with one bar per row in the BARS table, using each bar's `startTime` and `endTime` for its position and duration.
- **FR-017**: Each timeline bar MUST display the value of its `type` field as a visible text label inside the bar.
- **FR-018**: Each timeline bar MUST be placed on the track row corresponding to its `layer` field value; multiple bars MAY share the same track row and MUST all be rendered on it.
- **FR-019**: The system MUST handle an empty or absent BARS table gracefully by showing an empty timeline without errors.
- **FR-020**: The system MUST retain the database `id` of each BARS row in the in-memory representation of every timeline bar so that future edits can be written back to the correct row in the database.

### Key Entities *(include if feature involves data)*

- **Open Database File**: The local `.sqlite` file selected by the user as the active project database.
- **Active Database Session**: The current in-app state associated with the opened database, including whether it has unsaved changes.
- **Save Status**: The visible state of whether the active database is synchronized, pending save, or failed to save.
- **File Access Permission**: The browser-granted ability to read from or write to the selected local file.
- **Timeline Bar**: A visual block in the timeline derived from a BARS row, positioned by `startTime`/`endTime`, placed on the track given by `layer`, and labelled with `type`.

### Database Schema

The `.sqlite` project file uses the following tables:

#### `VARIABLES` — Project key-value settings

| Column     | Type | Constraints   |
|------------|------|---------------|
| `variable` | TEXT | PRIMARY KEY   |
| `value`    | TEXT |               |

Known keys and their meaning:

| Key                        | Example value | Description                                 |
|----------------------------|---------------|---------------------------------------------|
| `DBversion`                | `2`           | Schema version for migration checks         |
| `type`                     | *(string)*    | Demo/project type, also used as `engine`    |
| `startTime`                | `0`           | Timeline start time (seconds)               |
| `time`                     | `0`           | Current playhead time (seconds)             |
| `endTime`                  | `30`          | Timeline end time (seconds)                 |
| `fullScreen`               | `0`           | Whether to run fullscreen (0/1)             |
| `screenWidth`              | `640`         | Output canvas width in pixels               |
| `screenHeight`             | `400`         | Output canvas height in pixels              |
| `demoName`                 | `Untitled`    | Project display name                        |
| `demoLoop`                 | *(version)*   | Loop setting (stores latest DB version)     |
| `loaderBarCoordx0`         | `0.4`         | Loader progress bar left X (normalized)     |
| `loaderBarCoordy0`         | `0.3`         | Loader progress bar top Y (normalized)      |
| `loaderBarCoordx1`         | `0.6`         | Loader progress bar right X (normalized)    |
| `loaderBarCoordy1`         | `0.35`        | Loader progress bar bottom Y (normalized)   |
| `loaderBarBorderCoordx0`   | `0.4`         | Loader border left X (normalized)           |
| `loaderBarBorderCoordy0`   | `0.3`         | Loader border top Y (normalized)            |
| `loaderBarBorderCoordx1`   | `0.6`         | Loader border right X (normalized)          |
| `loaderBarBorderCoordy1`   | `0.35`        | Loader border bottom Y (normalized)         |
| `engine`                   | *(string)*    | Rendering engine identifier                 |

---

#### `BARS` — Timeline clips/segments

| Column       | Type           | Constraints | Description                          |
|--------------|----------------|-------------|--------------------------------------|
| `id`         | INTEGER        | PRIMARY KEY | Unique clip identifier               |
| `type`       | TEXT           |             | Clip/effect type                     |
| `layer`      | INTEGER        |             | Track/layer index                    |
| `startTime`  | DECIMAL(12,3)  |             | Clip start time (seconds)            |
| `endTime`    | DECIMAL(12,3)  |             | Clip end time (seconds)              |
| `enabled`    | BOOLEAN        |             | Whether the clip is active           |
| `selected`   | BOOLEAN        |             | Whether the clip is selected         |
| `script`     | TEXT           |             | Shader or script source code         |
| `srcBlending`| VARCHAR(50)    |             | Source blending factor               |
| `dstBlending`| VARCHAR(50)    |             | Destination blending factor          |
| `blendingEQ` | VARCHAR(50)    |             | Blending equation                    |
| `srcAlpha`   | VARCHAR(50)    |             | Source alpha blending factor         |
| `dstAlpha`   | VARCHAR(50)    |             | Destination alpha blending factor    |

---

#### `FBOs` — Framebuffer objects (render targets)

| Column             | Type    | Constraints                    | Description                    |
|--------------------|---------|--------------------------------|--------------------------------|
| `id`               | INTEGER | PRIMARY KEY                    | Unique FBO identifier          |
| `ratio`            | INTEGER |                                | Aspect ratio mode              |
| `width`            | INTEGER |                                | Width in pixels                |
| `height`           | INTEGER |                                | Height in pixels               |
| `format`           | TEXT    |                                | Texture format                 |
| `colorAttachments` | INTEGER |                                | Number of color attachments    |
| `filter`           | TEXT    | DEFAULT `'Bilinear'`           | Texture filter mode            |

---

#### `FILES` — Binary file assets

| Column    | Type    | Constraints | Description                          |
|-----------|---------|-------------|--------------------------------------|
| `id`      | INTEGER | PRIMARY KEY | Unique file identifier               |
| `name`    | TEXT    |             | File name                            |
| `parent`  | INTEGER |             | Parent folder id (FK → FOLDERS.id)   |
| `bytes`   | INTEGER |             | File size in bytes                   |
| `type`    | TEXT    |             | MIME type or asset category          |
| `data`    | BLOB    |             | Raw binary content                   |
| `format`  | TEXT    |             | Encoding or format hint              |
| `enabled` | BOOLEAN |             | Whether the file is active           |

---

#### `FOLDERS` — Asset folder hierarchy

| Column    | Type    | Constraints | Description                          |
|-----------|---------|-------------|--------------------------------------|
| `id`      | INTEGER | PRIMARY KEY | Unique folder identifier             |
| `name`    | TEXT    |             | Folder display name                  |
| `parent`  | INTEGER |             | Parent folder id (self-referencing)  |
| `enabled` | BOOLEAN |             | Whether the folder is active         |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a local `.sqlite` file from the menu and see the app load it successfully in a supported browser.
- **SC-002**: A user can save changes back to the same opened file without creating a separate copy.
- **SC-007**: A user can use "Guardar como" to save the current database to a new file, after which the app works from the new file.
- **SC-003**: The app remains usable after a canceled open flow or a denied file permission request.
- **SC-004**: Manual validation confirms that invalid file selection and save failures are explained clearly to the user.
- **SC-005**: Manual validation confirms that the app still loads and operates as a static browser app with no backend.
- **SC-008**: A user can open a `.sqlite` file with BARS data and see the bars appear in the timeline at the correct positions with their type labels visible.
- **SC-009**: Manual validation confirms the timeline clears and shows an empty state when a database with no BARS rows is opened.
- **SC-006**: Project lint, typecheck, and build checks complete without new errors for the file open/save feature.

## Assumptions

- The user intends a single active database file at a time.
- The first version focuses on direct open and save flows, not file import/export variants.
- If the browser cannot provide write access to the same file, the app will treat that as a blocking limitation for the save action rather than silently switching to a different target.
- The existing shell and workspace stay available even when no database has been opened yet.
- The timeline uses the `layer` field to determine track placement; multiple bars sharing the same `layer` value all appear on that track. Tracks are created on demand from the distinct `layer` values present in BARS.
- The `type` field of a BARS row is used as the bar label; no separate name or title field exists in the schema.
- Timeline bar rendering is read from the loaded in-memory data; it does not re-query the SQLite file at render time.
